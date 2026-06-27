package cmd

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func runWithMockIO(t *testing.T, stdinData []byte, run func() error) ([]byte, error) {
	rStdin, wStdin, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	rStdout, wStdout, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}

	oldStdin := os.Stdin
	oldStdout := os.Stdout
	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
	}()

	os.Stdin = rStdin
	os.Stdout = wStdout

	go func() {
		defer wStdin.Close()
		_, _ = wStdin.Write(stdinData)
	}()

	var stdoutBuf bytes.Buffer
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = stdoutBuf.ReadFrom(rStdout)
	}()

	runErr := run()
	wStdout.Close()
	<-done

	return stdoutBuf.Bytes(), runErr
}

func TestExecuteMissingSubcommand(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	os.Args = []string{"swarmvault-native"}
	err := Execute()
	if err == nil || err.Error() != "missing subcommand" {
		t.Errorf("expected error 'missing subcommand', got %v", err)
	}
}

func TestExecuteUnknownSubcommand(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	os.Args = []string{"swarmvault-native", "invalid-command-xyz"}
	err := Execute()
	if err == nil || err.Error() != "unknown subcommand: invalid-command-xyz" {
		t.Errorf("expected error 'unknown subcommand: invalid-command-xyz', got %v", err)
	}
}

func TestHandleUtilsSlugify(t *testing.T) {
	payload := struct {
		Action string `json:"action"`
		Args   any    `json:"args"`
	}{
		Action: "slugify",
		Args: struct {
			Value string `json:"value"`
		}{
			Value: "Hello World Go Testing",
		},
	}

	inputBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	outputBytes, err := runWithMockIO(t, inputBytes, HandleUtils)
	if err != nil {
		t.Fatalf("unexpected error running HandleUtils: %v", err)
	}

	var response string
	if err := json.Unmarshal(outputBytes, &response); err != nil {
		t.Fatalf("failed to decode response: %v, raw output: %q", err, string(outputBytes))
	}

	expected := "hello-world-go-testing"
	if response != expected {
		t.Errorf("expected response %q, got %q", expected, response)
	}
}

func TestHandleAgentsStatus(t *testing.T) {
	rootDir := t.TempDir()
	payload := struct {
		Action string `json:"action"`
		Args   any    `json:"args"`
	}{
		Action: "getAgentInstallStatus",
		Args: struct {
			RootDir string `json:"rootDir"`
			Agent   string `json:"agent"`
			Options any    `json:"options"`
		}{
			RootDir: rootDir,
			Agent:   "gemini",
			Options: struct{}{},
		},
	}

	inputBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	outputBytes, err := runWithMockIO(t, inputBytes, HandleAgents)
	if err != nil {
		t.Fatalf("unexpected error running HandleAgents: %v", err)
	}

	var response struct {
		Agent     string `json:"agent"`
		Installed bool   `json:"installed"`
	}
	if err := json.Unmarshal(outputBytes, &response); err != nil {
		t.Fatalf("failed to decode response: %v, raw: %q", err, string(outputBytes))
	}

	if response.Agent != "gemini" {
		t.Errorf("expected agent 'gemini', got %q", response.Agent)
	}
	if response.Installed {
		t.Errorf("expected Installed to be false for non-existent files")
	}
}

func TestHandleChatSessionPrepare(t *testing.T) {
	rootDir := t.TempDir()
	payload := struct {
		Action string `json:"action"`
		Args   any    `json:"args"`
	}{
		Action: "askChatSessionPrepare",
		Args: struct {
			RootDir string `json:"rootDir"`
			Options any    `json:"options"`
			Now     string `json:"now"`
		}{
			RootDir: rootDir,
			Options: struct {
				Question string `json:"question"`
			}{
				Question: "Hello",
			},
			Now: "2026-06-26T12:00:00Z",
		},
	}

	inputBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	outputBytes, err := runWithMockIO(t, inputBytes, HandleChat)
	if err != nil {
		t.Fatalf("unexpected error running HandleChat: %v", err)
	}

	var response struct {
		Session struct {
			Title string `json:"title"`
		} `json:"session"`
		Prompt string `json:"prompt"`
	}
	if err := json.Unmarshal(outputBytes, &response); err != nil {
		t.Fatalf("failed to decode response: %v, raw: %q", err, string(outputBytes))
	}

	if response.Session.Title != "Hello" {
		t.Errorf("expected session title 'Hello', got %q", response.Session.Title)
	}
	if response.Prompt == "" {
		t.Errorf("expected non-empty prompt")
	}
}
