package main

import (
	"bytes"
	"io"
	"os/exec"
	"testing"
)

func TestMainProgramValidJSON(t *testing.T) {
	// Simple test validating our binary using exec
	cmd := exec.Command("go", "run", "main.go")
	cmd.Dir = "."

	stdin, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}

	io.WriteString(stdin, `{"key": "value"}`)
	stdin.Close()

	if err := cmd.Wait(); err != nil {
		t.Fatalf("expected command to exit successfully, got err: %v\nstderr: %s", err, stderr.String())
	}

	expected := `{"key":"value"}`
	if stdout.String() != expected {
		t.Errorf("expected %q, got %q", expected, stdout.String())
	}
}

func TestMainProgramInvalidJSON(t *testing.T) {
	cmd := exec.Command("go", "run", "main.go")
	cmd.Dir = "."

	stdin, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}

	io.WriteString(stdin, `invalid json`)
	stdin.Close()

	err = cmd.Wait()
	if err == nil {
		t.Fatal("expected command to fail with invalid JSON")
	}

	if stderr.Len() == 0 {
		t.Error("expected error message on stderr")
	}
}
