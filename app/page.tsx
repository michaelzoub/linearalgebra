"use client";
import { useState } from "react";
import { Text } from "@maximeheckel/design-system";
import ChangeOfBasis from "@/components/ChangeOfBasis";

const TABS = [{ id: "change-of-basis", label: "Change of Basis" }];

export default function Home() {
  const [activeTab, setActiveTab] = useState("change-of-basis");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border-color)",
        padding: "16px 24px",
        background: "var(--header)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>
          Linear Algebra Visualizer
        </span>
        <Text size="1" css={{ color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          powered by mathjs
        </Text>
      </header>

      {/* Tab nav */}
      <nav style={{ borderBottom: "1px solid var(--border-color)", padding: "0 24px", display: "flex" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-tertiary)",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 24 }}>
        {activeTab === "change-of-basis" && <ChangeOfBasis />}
      </main>
    </div>
  );
}
