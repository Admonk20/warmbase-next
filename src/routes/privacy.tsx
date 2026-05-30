import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Privacy Policy" description="Last updated: May 30, 2026" />
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This Privacy Policy explains how WarmBase collects, uses, and discloses information.</p>
          <h3 className="mt-4 font-semibold">Information We Collect</h3>
          <p className="text-sm text-muted-foreground">We collect information you provide directly and usage data to operate and improve the service.</p>
          <h3 className="mt-4 font-semibold">How We Use Information</h3>
          <p className="text-sm text-muted-foreground">We use information to provide, maintain, and improve our services and for security.</p>
          <h3 className="mt-4 font-semibold">Contact</h3>
          <p className="text-sm text-muted-foreground">Contact us at support@example.com for privacy questions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
