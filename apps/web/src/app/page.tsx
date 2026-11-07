import { redirect } from 'next/navigation';

/**
 * The app home: the workspace is user-specific, so the root does not guess an
 * id (a hardcoded seed workspace does not exist on production deployments).
 * The workspaces screen lists the user's real workspaces and offers creation.
 */
export default function Home() {
  redirect('/workspaces');
}
