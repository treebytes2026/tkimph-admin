"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="size-5" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Settings page coming soon.</p>
      </CardContent>
    </Card>
  );
}
