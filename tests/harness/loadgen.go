//go:build ignore

// Stands in for a monitoring stack in the docs' btop screenshot. Copied in
// under each service's name, it holds that service's memory and works in waves
// of CPU so the graphs have something to draw.
package main

import (
	"math"
	"math/rand/v2"
	"os"
	"path/filepath"
	"time"
)

type profile struct {
	memoryMB int
	workers  int
	// Each worker's share of a core swings between base and base+swing.
	base   float64
	swing  float64
	period time.Duration
}

var profiles = map[string]profile{
	"grafana-server": {memoryMB: 180, workers: 2, base: 0.05, swing: 0.45, period: 7 * time.Second},
	"prometheus":     {memoryMB: 260, workers: 3, base: 0.1, swing: 0.7, period: 11 * time.Second},
	"loki":           {memoryMB: 120, workers: 1, base: 0.05, swing: 0.4, period: 5 * time.Second},
	"node_exporter":  {memoryMB: 20, workers: 1, base: 0.02, swing: 0.1, period: 3 * time.Second},
}

const slice = 50 * time.Millisecond

func main() {
	p, ok := profiles[filepath.Base(os.Args[0])]
	if !ok {
		os.Exit(1)
	}

	// Touched so it counts toward the process's resident memory.
	memory := make([]byte, p.memoryMB<<20)
	for i := range memory {
		memory[i] = byte(i)
	}

	start := time.Now()
	for w := range p.workers {
		phase := float64(w) / float64(p.workers) * math.Pi
		go work(p, start, phase)
	}

	select {}
}

func work(p profile, start time.Time, phase float64) {
	for {
		t := time.Since(start).Seconds() / p.period.Seconds()
		duty := p.base + p.swing*(math.Sin(2*math.Pi*t+phase)+1)/2
		duty = min(1, duty*(0.8+0.4*rand.Float64()))

		busy := time.Duration(duty * float64(slice))
		for until := time.Now().Add(busy); time.Now().Before(until); {
		}

		time.Sleep(slice - busy)
	}
}
