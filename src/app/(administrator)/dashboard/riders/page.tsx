"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bike } from "lucide-react";

export default function RidersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bike className="size-5" />
          Riders Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Rider management coming soon.</p>
      </CardContent>
    </Card>
  );
}
