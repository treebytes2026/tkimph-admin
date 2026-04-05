"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminSettings } from "@/lib/admin-api";

export default function AdminSettlementsPage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void fetchAdminSettings()
      .then((settings) => setEnabled(settings.settlements_enabled))
      .catch(() => setEnabled(false));
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{enabled ? "Settlements enabled" : "Settlements disabled"}</CardTitle>
          <CardDescription>
            Manual restaurant settlements, payment-proof uploads, and overdue settlement actions are controlled from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Current status: <span className="font-semibold text-foreground">{enabled ? "Enabled" : "Disabled"}</span></p>
          <p>Restaurants now use the admin-configured commission model per dish sold.</p>
          <p>Use <span className="font-semibold text-foreground">Dashboard Settings</span> to change the commission rate and turn settlements on or off.</p>
        </CardContent>
      </Card>
    </div>
  );
}
