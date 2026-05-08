"use client"

import { useState } from "react"
import { Sidebar } from "@/components/hana-cloud/sidebar"
import { MainContent } from "@/components/hana-cloud/main-content"
import { SettingsContent } from "@/components/hana-cloud/settings-content"

export default function HANACloudPage() {
  const [activeSection, setActiveSection] = useState("My Drive")

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        activeItem={activeSection}
        onNavigate={setActiveSection}
      />
      {activeSection === "Settings" ? (
        <SettingsContent />
      ) : (
        <MainContent activeSection={activeSection} />
      )}
    </div>
  )
}
