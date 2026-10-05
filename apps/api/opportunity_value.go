package main

import (
	"log"
	"math"
	"strings"
	"time"
)

// Valor das oportunidades: dinheiro em DECIMAL(14,2) (Float acumula erro de centavos nas somas) e a
// data em que a oportunidade foi para Ganho (wonAt), que alimenta "valor ganho por período".

// ensureOpportunitySchema é idempotente e tolerante: se a migração falhar, a API sobe mesmo assim
// (o CRM continua funcionando com o tipo antigo) e o erro vai pro log.
func ensureOpportunitySchema() {
	var dataType string
	err := db.QueryRow(`SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Opportunity' AND COLUMN_NAME = 'value'`).Scan(&dataType)
	if err != nil {
		log.Println("⚠️ não consegui ler o tipo de Opportunity.value:", err)
	} else if !strings.EqualFold(dataType, "decimal") {
		if _, err := db.Exec(`ALTER TABLE Opportunity MODIFY value DECIMAL(14,2) NULL`); err != nil {
			log.Println("⚠️ migração de Opportunity.value para DECIMAL falhou:", err)
		} else {
			log.Println("✅ Opportunity.value agora é DECIMAL(14,2)")
		}
	}

	if _, err := db.Exec(`ALTER TABLE Opportunity ADD COLUMN wonAt DATETIME NULL`); err != nil {
		if !strings.Contains(err.Error(), "Duplicate column") {
			log.Println("⚠️ não consegui adicionar Opportunity.wonAt:", err)
		}
		return
	}
	// Primeira vez: as que já estavam em Ganho (valor legado "WON") ganham a última atualização
	// como data de fechamento; as de etapas de pipeline ficam sem data até serem movidas.
	if _, err := db.Exec(`UPDATE Opportunity SET wonAt = updatedAt WHERE stage = 'WON' AND wonAt IS NULL`); err != nil {
		log.Println("⚠️ preenchimento inicial de wonAt falhou:", err)
	}
}

// normalizeMoney arredonda para centavos e recusa valor negativo ou absurdo (DECIMAL(14,2)).
func normalizeMoney(v *float64) (*float64, bool) {
	if v == nil {
		return nil, true
	}
	if math.IsNaN(*v) || math.IsInf(*v, 0) || *v < 0 || *v >= 1e12 {
		return nil, false
	}
	r := math.Round(*v*100) / 100
	return &r, true
}

// wonAtFor devolve o que gravar em wonAt ao mover a oportunidade: agora se foi para Ganho
// (o admin avisa com won=true; o valor legado "WON" também conta), nulo caso contrário.
func wonAtFor(stage string, won bool, now time.Time) any {
	if won || stage == "WON" {
		return now
	}
	return nil
}
