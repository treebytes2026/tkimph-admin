"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";

export default function OrdersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5" />
          Orders Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Order management coming soon.</p>
      </CardContent>
    </Card>
  );
}
