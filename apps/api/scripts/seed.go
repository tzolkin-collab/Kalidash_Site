package scripts

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	dsn := os.Getenv("DSN")
	if dsn == "" {
		log.Fatal("DSN não configurado")
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Limpa tudo
	db.Exec("DELETE FROM Opportunity")
	db.Exec("DELETE FROM Contact")
	db.Exec("DELETE FROM Company")

	// UUIDs reais para o Prisma não quebrar!
	comp1 := "f03b2210-94b8-4d56-a197-2a543f4a3e21"
	comp2 := "c7a8b9f0-d3e4-4c21-b8f9-e1a2d3c4b5a6"
	
	cont1 := "d5b4a3c2-b1e0-4f9d-8c7a-6b5a4d3c2e1f"
	cont2 := "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d"
	cont3 := "e5d4c3b2-a1f0-49e8-7d6c-5b4a3c2d1e0f"

	opp1 := "b2c3d4e5-f6a7-48b9-9c0d-1e2f3a4b5c6d"
	opp2 := "c3d4e5f6-a7b8-49c0-0d1e-2f3a4b5c6d7e"
	opp3 := "d4e5f6a7-b8c9-4ad1-1e2f-3a4b5c6d7e8f"

	// Empresas
	db.Exec(fmt.Sprintf(`INSERT INTO Company (id, name, logoUrl, website) VALUES ('%s', 'Agência Tzolkin', 'https://logo.clearbit.com/tzolkin.com.br', 'https://tzolkin.com.br')`, comp1))
	db.Exec(fmt.Sprintf(`INSERT INTO Company (id, name, logoUrl, website) VALUES ('%s', 'Acme Corp', 'https://logo.clearbit.com/acme.com', 'https://acme.com')`, comp2))

	// Contatos
	db.Exec(fmt.Sprintf(`INSERT INTO Contact (id, name, email, avatarUrl, companyId) VALUES ('%s', 'João Silva', 'joao@acme.com', 'https://i.pravatar.cc/150?u=joao', '%s')`, cont1, comp2))
	db.Exec(fmt.Sprintf(`INSERT INTO Contact (id, name, email, avatarUrl, companyId) VALUES ('%s', 'Carol Sales', 'carol@agenciatzolkin.com', 'https://i.pravatar.cc/150?u=carol', '%s')`, cont2, comp1))
	db.Exec(fmt.Sprintf(`INSERT INTO Contact (id, name, email, avatarUrl, companyId) VALUES ('%s', 'Maria Oliveira', 'maria@gmail.com', 'https://i.pravatar.cc/150?u=maria', NULL)`, cont3))

	// Oportunidades
	db.Exec(fmt.Sprintf(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, companyId, contactId, createdAt, updatedAt) VALUES ('%s', 'Consultoria de Vendas Q4', 15000, 'INBOUND', 'HIGH', '["Enterprise", "Urgente"]', '%s', '%s', NOW(), NOW())`, opp1, comp2, cont1))
	db.Exec(fmt.Sprintf(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, companyId, contactId, createdAt, updatedAt) VALUES ('%s', 'Mentoria Individual', 2000, 'QUALIFICATION', 'MEDIUM', '["B2C", "Indicação"]', NULL, '%s', NOW(), NOW())`, opp2, cont3))
	db.Exec(fmt.Sprintf(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, companyId, contactId, createdAt, updatedAt) VALUES ('%s', 'Treinamento de Equipe', 8500, 'WON', 'LOW', '["Fechado"]', '%s', '%s', NOW(), NOW())`, opp3, comp1, cont2))

	fmt.Println("✅ IDs UUID gerados e inseridos no TiDB!")
}
