import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";

const user = { id: 7, name: "Noor", email: "noor@example.com", phone: null };
const nav = (label) => fireEvent.click(screen.getByRole("button", { name: new RegExp(label + "$") }));

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("TrailQuest app", () => {
  it("greets the signed-in user", () => {
    render(<App user={user} token="t" logout={() => {}} />);
    expect(screen.getByText(/Noor/)).toBeTruthy();
  });

  it("switches mode and theme, and remembers them per account", () => {
    render(<App user={user} token="t" logout={() => {}} />);
    nav("Me"); fireEvent.click(screen.getByLabelText("Settings"));
    fireEvent.click(screen.getByText("🌙 Dark")); fireEvent.click(screen.getByLabelText("ocean"));
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("ocean");
    expect(JSON.parse(localStorage.getItem("tq2:7")).theme).toBe("ocean");
  });

  it("log out button calls logout", () => {
    const logout = vi.fn();
    render(<App user={user} token="t" logout={logout} />);
    nav("Me"); fireEvent.click(screen.getByLabelText("Settings")); fireEvent.click(screen.getByText("Log out"));
    expect(logout).toHaveBeenCalled();
  });

  it("shows a clear message when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<App user={user} token="t" logout={() => {}} />);
    nav("Quest"); fireEvent.click(screen.getByText("Generate quest"));
    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy();
  });

  it("signs the user out when the session has expired (401)", async () => {
    const logout = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    render(<App user={user} token="t" logout={logout} />);
    nav("Quest"); fireEvent.click(screen.getByText("Generate quest"));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
