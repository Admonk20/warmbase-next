import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Terms of Service" description="Effective date: May 30, 2026" />
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Please read these Terms of Service carefully before using WarmBase. By using the service you agree to these terms.</p>
          <h3 className="mt-4 font-semibold">1. Use of Service</h3>
          <p className="text-sm text-muted-foreground">You may use the service only in compliance with these terms and all applicable laws.</p>
          <h3 className="mt-4 font-semibold">2. Content</h3>
          <p className="text-sm text-muted-foreground">You are responsible for the content you submit and must not violate third-party rights.</p>
          <h3 className="mt-4 font-semibold">3. Liability</h3>
          <p className="text-sm text-muted-foreground">The service is provided "as is" without warranties. Liability is limited as permitted by law.</p>
        </CardContent>
      </Card>
    </div>
  );
}
