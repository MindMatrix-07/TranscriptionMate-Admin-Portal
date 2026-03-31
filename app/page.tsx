import { AdminLogin } from "@/components/admin-login";
import { AdminPortal } from "@/components/admin-portal";
import {
  isAdminPageAuthenticated,
  isAdminPasswordConfigured,
} from "@/lib/admin-auth";

export default async function Home() {
  const passwordConfigured = isAdminPasswordConfigured();
  const authenticated = await isAdminPageAuthenticated();

  if (!authenticated) {
    return <AdminLogin passwordConfigured={passwordConfigured} />;
  }

  return <AdminPortal authEnabled={passwordConfigured} />;
}
