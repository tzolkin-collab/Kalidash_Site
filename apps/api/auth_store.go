package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

// Login, sessão e perfis da equipe (docs/auth-study.md). DESLIGADO por padrão: com AUTH_API=1 a API
//   - cria TeamMember e AuthSession (CREATE TABLE IF NOT EXISTS; nada existente é alterado);
//   - registra /auth/* e passa a exigir sessão em /api/* (auth_middleware.go);
//   - restringe o CORS a ALLOWED_ORIGINS (com credenciais, sem "*").
// Sem a variável a API não toca no banco e se comporta como antes (aberta). Faça backup antes de ligar.

func authEnabled() bool { return os.Getenv("AUTH_API") == "1" }

// Perfis, com os mesmos nomes de apps/admin/src/domain.ts (Role).
const (
	roleAdmin   = "ADMIN"
	roleManager = "MANAGER"
	roleSeller  = "SELLER"
)

var validRoles = map[string]bool{roleAdmin: true, roleManager: true, roleSeller: true}

// isManager: Admin e Gerente (mesma regra de `manager` em apps/admin/src/lib/permissions.ts).
func isManager(role string) bool { return role == roleAdmin || role == roleManager }

const authSchema = `
CREATE TABLE IF NOT EXISTS TeamMember (
	id VARCHAR(64) PRIMARY KEY,
	email VARCHAR(254) NOT NULL,
	name VARCHAR(200) NOT NULL DEFAULT '',
	avatarUrl VARCHAR(500) NULL,
	googleSub VARCHAR(64) NULL,
	role VARCHAR(8) NOT NULL,
	active TINYINT(1) NOT NULL DEFAULT 1,
	lastLoginAt DATETIME NULL,
	invitedBy VARCHAR(64) NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	UNIQUE KEY uq_team_email (email),
	UNIQUE KEY uq_team_sub (googleSub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS AuthSession (
	tokenHash CHAR(64) PRIMARY KEY,
	memberId VARCHAR(64) NOT NULL,
	createdAt DATETIME NOT NULL,
	expiresAt DATETIME NOT NULL,
	ip VARCHAR(45) NULL,
	userAgent VARCHAR(255) NULL,
	INDEX idx_session_member (memberId),
	INDEX idx_session_expires (expiresAt),
	CONSTRAINT fk_session_member FOREIGN KEY (memberId) REFERENCES TeamMember(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

// Member é uma pessoa da equipe. Status é derivado: DISABLED (desativada), INVITED (nunca entrou) ou ACTIVE.
type Member struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	AvatarURL  string    `json:"avatarUrl,omitempty"`
	Role       string    `json:"role"`
	Active     bool      `json:"active"`
	Status     string    `json:"status"`
	LastAccess *FlexTime `json:"lastAccess,omitempty"`
	GoogleSub  string    `json:"-"`
	Root       bool      `json:"root,omitempty"`
}

var (
	errMemberNotFound  = errors.New("pessoa da equipe não encontrada")
	errMemberExists    = errors.New("este e-mail já está na equipe")
	errLastAdmin       = errors.New("o sistema precisa de pelo menos um Admin ativo")
	errSessionNotFound = errors.New("sessão inválida")
)

// authStore isola o SQL: o middleware e os handlers dependem só disto (os testes de unidade usam um
// armazenamento em memória; o SQL real é coberto por auth_integration_test.go).
type authStore interface {
	ListMembers() ([]Member, error)
	MemberByID(id string) (Member, error)
	MemberByEmail(email string) (Member, error)
	MemberBySub(sub string) (Member, error)
	AddMember(m Member, invitedBy string) (Member, error)
	// UpdateMember muda nome, perfil e/ou situação; recusa deixar a equipe sem Admin ativo.
	UpdateMember(id string, name *string, role *string, active *bool) (Member, error)
	// TouchLogin grava o vínculo com a conta Google, foto, nome (se vazio) e a data do acesso.
	TouchLogin(id, sub, name, avatar string) error
	CreateSession(hash, memberID, ip, ua string, expires time.Time) error
	// SessionMember devolve o membro ATIVO dono da sessão não expirada.
	SessionMember(hash string, now time.Time) (Member, error)
	// ExtendSession renova a sessão para `expires` quando ela vence antes de `below`; diz se renovou.
	ExtendSession(hash string, expires, below time.Time) (bool, error)
	DeleteSession(hash string) error
	DeleteMemberSessions(memberID string) error
	PurgeExpired(now time.Time) error
	CountActiveAdmins() (int, error)
}

var authDB authStore = sqlAuthStore{}

type sqlAuthStore struct{}

const memberCols = `id, email, name, avatarUrl, googleSub, role, active, lastLoginAt`

func scanMember(sc interface{ Scan(...any) error }) (Member, error) {
	var m Member
	var avatar, sub, last sql.NullString
	var active int
	if err := sc.Scan(&m.ID, &m.Email, &m.Name, &avatar, &sub, &m.Role, &active, &last); err != nil {
		return Member{}, err
	}
	m.AvatarURL, m.GoogleSub, m.Active = avatar.String, sub.String, active == 1
	m.Root = root(m)
	if last.Valid {
		m.LastAccess = flexFrom(last.String)
	}
	switch {
	case !m.Active:
		m.Status = "DISABLED"
	case m.LastAccess == nil:
		m.Status = "INVITED"
	default:
		m.Status = "ACTIVE"
	}
	return m, nil
}

func oneMember(where string, args ...any) (Member, error) {
	m, err := scanMember(db.QueryRow(`SELECT `+memberCols+` FROM TeamMember WHERE `+where, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return Member{}, errMemberNotFound
	}
	return m, err
}

func (sqlAuthStore) ListMembers() ([]Member, error) {
	rows, err := db.Query(`SELECT ` + memberCols + ` FROM TeamMember ORDER BY createdAt, email`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Member{}
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (sqlAuthStore) MemberByID(id string) (Member, error)       { return oneMember(`id = ?`, id) }
func (sqlAuthStore) MemberByEmail(email string) (Member, error) { return oneMember(`email = ?`, email) }
func (sqlAuthStore) MemberBySub(sub string) (Member, error)     { return oneMember(`googleSub = ?`, sub) }

func (sqlAuthStore) AddMember(m Member, invitedBy string) (Member, error) {
	if m.ID == "" {
		m.ID = wfID("tm")
	}
	now := time.Now()
	_, err := db.Exec(`INSERT INTO TeamMember (id, email, name, role, active, invitedBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
		m.ID, m.Email, m.Name, m.Role, nullStr(invitedBy), now, now)
	if err != nil {
		if isDup(err) {
			return Member{}, errMemberExists
		}
		return Member{}, err
	}
	return oneMember(`id = ?`, m.ID)
}

func (sqlAuthStore) UpdateMember(id string, name *string, role *string, active *bool) (Member, error) {
	tx, err := db.Begin()
	if err != nil {
		return Member{}, err
	}
	defer tx.Rollback()
	cur, err := scanMember(tx.QueryRow(`SELECT `+memberCols+` FROM TeamMember WHERE id = ? FOR UPDATE`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Member{}, errMemberNotFound
	} else if err != nil {
		return Member{}, err
	}
	newRole, newActive, newName := cur.Role, cur.Active, cur.Name
	if role != nil {
		newRole = *role
	}
	if active != nil {
		newActive = *active
	}
	if name != nil {
		newName = *name
	}
	if cur.Role == roleAdmin && cur.Active && (newRole != roleAdmin || !newActive) {
		// trava as linhas de Admin ativo para duas trocas simultâneas não zerarem a lista
		var n int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM (SELECT id FROM TeamMember WHERE role = ? AND active = 1 FOR UPDATE) a`, roleAdmin).Scan(&n); err != nil {
			return Member{}, err
		}
		if n <= 1 {
			return Member{}, errLastAdmin
		}
	}
	act := 0
	if newActive {
		act = 1
	}
	if _, err := tx.Exec(`UPDATE TeamMember SET name = ?, role = ?, active = ?, updatedAt = ? WHERE id = ?`, newName, newRole, act, time.Now(), id); err != nil {
		return Member{}, err
	}
	if !newActive {
		if _, err := tx.Exec(`DELETE FROM AuthSession WHERE memberId = ?`, id); err != nil {
			return Member{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return Member{}, err
	}
	return oneMember(`id = ?`, id)
}

func (sqlAuthStore) TouchLogin(id, sub, name, avatar string) error {
	_, err := db.Exec(`UPDATE TeamMember SET googleSub = COALESCE(googleSub, ?), avatarUrl = ?, name = CASE WHEN name = '' THEN ? ELSE name END, lastLoginAt = ?, updatedAt = ? WHERE id = ?`,
		nullStr(sub), nullStr(avatar), name, time.Now(), time.Now(), id)
	return err
}

func (sqlAuthStore) CreateSession(hash, memberID, ip, ua string, expires time.Time) error {
	_, err := db.Exec(`INSERT INTO AuthSession (tokenHash, memberId, createdAt, expiresAt, ip, userAgent) VALUES (?, ?, ?, ?, ?, ?)`,
		hash, memberID, time.Now(), expires, nullStr(ip), nullStr(clip(ua, 255)))
	return err
}

func (sqlAuthStore) SessionMember(hash string, now time.Time) (Member, error) {
	m, err := scanMember(db.QueryRow(`SELECT m.id, m.email, m.name, m.avatarUrl, m.googleSub, m.role, m.active, m.lastLoginAt
		FROM AuthSession s JOIN TeamMember m ON m.id = s.memberId
		WHERE s.tokenHash = ? AND s.expiresAt > ? AND m.active = 1`, hash, now))
	if errors.Is(err, sql.ErrNoRows) {
		return Member{}, errSessionNotFound
	}
	return m, err
}

func (sqlAuthStore) ExtendSession(hash string, expires, below time.Time) (bool, error) {
	res, err := db.Exec(`UPDATE AuthSession SET expiresAt = ? WHERE tokenHash = ? AND expiresAt < ?`, expires, hash, below)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (sqlAuthStore) DeleteSession(hash string) error {
	_, err := db.Exec(`DELETE FROM AuthSession WHERE tokenHash = ?`, hash)
	return err
}

func (sqlAuthStore) DeleteMemberSessions(memberID string) error {
	_, err := db.Exec(`DELETE FROM AuthSession WHERE memberId = ?`, memberID)
	return err
}

func (sqlAuthStore) PurgeExpired(now time.Time) error {
	_, err := db.Exec(`DELETE FROM AuthSession WHERE expiresAt <= ?`, now)
	return err
}

func (sqlAuthStore) CountActiveAdmins() (int, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM TeamMember WHERE role = ? AND active = 1`, roleAdmin).Scan(&n)
	return n, err
}

func clip(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

// ensureAuthSchema é idempotente. Falha alta: com AUTH_API=1 o operador pediu o recurso, e uma API
// "protegida" que subiu mal configurada seria pior que uma que não sobe.
func ensureAuthSchema() {
	if err := validateAuthConfig(); err != nil {
		log.Fatalf("❌ AUTH: %v", err)
	}
	for _, stmt := range splitStatements(authSchema) {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("❌ AUTH: erro ao criar tabelas da equipe/sessões: %v", err)
		}
	}
	if err := bootstrapAdmin(authDB); err != nil {
		log.Fatalf("❌ AUTH: %v", err)
	}
	log.Println("✅ Login e perfis prontos (AUTH_API=1)")
}

// validateAuthConfig confere o que não pode faltar com AUTH_API=1.
func validateAuthConfig() error {
	if len(os.Getenv("SESSION_SECRET")) < 32 {
		return fmt.Errorf("SESSION_SECRET precisa ter 32 caracteres ou mais")
	}
	if len(configuredOrigins()) == 0 {
		return fmt.Errorf("ALLOWED_ORIGINS (ou SITE_URL) precisa listar a origem do admin: com login o CORS não aceita \"*\"")
	}
	if os.Getenv("AUTH_DEV_LOGIN") != "1" {
		for _, k := range []string{"GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URL", "ADMIN_URL"} {
			if os.Getenv(k) == "" {
				return fmt.Errorf("%s não configurada (ou use AUTH_DEV_LOGIN=1 só em desenvolvimento)", k)
			}
		}
	}
	return nil
}

// rootAdminEmail é o Admin raiz (rootDev): a conta central definida no servidor, que a Tzolkin entrega
// à Kalidash. AUTH_ROOT_ADMIN; AUTH_BOOTSTRAP_ADMIN segue valendo como nome antigo.
func rootAdminEmail() string {
	if v := normEmail(os.Getenv("AUTH_ROOT_ADMIN")); v != "" {
		return v
	}
	return normEmail(os.Getenv("AUTH_BOOTSTRAP_ADMIN"))
}

// bootstrapAdmin garante a conta raiz a CADA subida: cria se não existe e, se existe, volta a ser
// Admin ativo (quem tem acesso ao servidor sempre consegue recuperar o acesso). Pela tela ela não pode
// ser rebaixada nem desativada (handleTeamByID).
func bootstrapAdmin(st authStore) error {
	email := rootAdminEmail()
	if email == "" {
		return nil
	}
	if !validEmail(email) {
		return fmt.Errorf("AUTH_ROOT_ADMIN não é um e-mail válido")
	}
	cur, err := st.MemberByEmail(email)
	switch {
	case errors.Is(err, errMemberNotFound):
		_, err = st.AddMember(Member{Email: email, Role: roleAdmin}, "")
	case err != nil:
	case cur.Role != roleAdmin || !cur.Active:
		role, active := roleAdmin, true
		_, err = st.UpdateMember(cur.ID, nil, &role, &active)
	}
	if err == nil {
		log.Println("✅ AUTH: conta Admin raiz garantida (AUTH_ROOT_ADMIN)")
	}
	return err
}

func normEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func validEmail(s string) bool {
	at := strings.LastIndex(s, "@")
	return len(s) <= 254 && at > 0 && strings.Contains(s[at+1:], ".") && !strings.ContainsAny(s, " \t\r\n<>,;\"")
}
