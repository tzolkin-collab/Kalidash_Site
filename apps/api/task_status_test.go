package main

import (
	"testing"
	"time"
)

func TestNormalizeTaskStatus(t *testing.T) {
	cases := []struct {
		done   bool
		status string
		want   string
	}{
		{false, "", "TODO"},         // tarefa antiga, sem status
		{false, "DOING", "DOING"},   // aberta mantém o status válido
		{false, "BLOCKED", "BLOCKED"},
		{false, "DONE", "TODO"},     // DONE com done=0 é incoerente: reabre
		{false, "LIXO", "TODO"},
		{true, "", "DONE"},          // concluída é sempre DONE
		{true, "DOING", "DONE"},
	}
	for _, c := range cases {
		if got := normalizeTaskStatus(c.done, c.status); got != c.want {
			t.Errorf("normalizeTaskStatus(%v, %q) = %q; quer %q", c.done, c.status, got, c.want)
		}
	}
}

func TestApplyTaskStatus(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)

	// concluir marca done e doneAt
	cur := TaskDTO{Status: "DOING"}
	if err := applyTaskStatus(&cur, "DONE", now); err != nil {
		t.Fatal(err)
	}
	if !cur.Done || cur.DoneAt == nil || !cur.DoneAt.Equal(now) || cur.Status != "DONE" {
		t.Errorf("concluir: %+v", cur)
	}

	// concluir de novo não muda a data de conclusão
	later := now.Add(time.Hour)
	if err := applyTaskStatus(&cur, "DONE", later); err != nil {
		t.Fatal(err)
	}
	if !cur.DoneAt.Equal(now) {
		t.Errorf("a data de conclusão não pode mudar: %v", cur.DoneAt)
	}

	// reabrir limpa done e doneAt
	if err := applyTaskStatus(&cur, "BLOCKED", later); err != nil {
		t.Fatal(err)
	}
	if cur.Done || cur.DoneAt != nil || cur.Status != "BLOCKED" {
		t.Errorf("reabrir: %+v", cur)
	}

	// status desconhecido é recusado e não altera nada
	before := cur
	if err := applyTaskStatus(&cur, "FEITO", later); err == nil {
		t.Error("status inválido devia ser recusado")
	}
	if cur.Status != before.Status || cur.Done != before.Done {
		t.Errorf("recusa não pode alterar a tarefa: %+v", cur)
	}
}
