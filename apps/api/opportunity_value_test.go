package main

import (
	"testing"
	"time"
)

func TestNormalizeMoney(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	if got, ok := normalizeMoney(f(10.005)); !ok || (*got != 10.01 && *got != 10.0) {
		t.Errorf("arredondamento: %v %v", got, ok)
	}
	if got, ok := normalizeMoney(f(1234.567)); !ok || *got != 1234.57 {
		t.Errorf("centavos: %v", got)
	}
	if got, ok := normalizeMoney(nil); !ok || got != nil {
		t.Error("nulo deve passar")
	}
	for _, bad := range []float64{-1, 1e12} {
		if _, ok := normalizeMoney(f(bad)); ok {
			t.Errorf("%v deveria ser recusado", bad)
		}
	}
}

func TestWonAtFor(t *testing.T) {
	now := time.Now()
	if wonAtFor("q4:ganho", true, now) != now || wonAtFor("WON", false, now) != now {
		t.Error("ganho deve gravar a data")
	}
	if wonAtFor("q4:proposta", false, now) != nil {
		t.Error("etapa aberta deve limpar a data")
	}
}
