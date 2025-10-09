import { useNavigate } from "@tanstack/react-router";

export function ShellOnly({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  if (window.electron) {
    return children;
  } else {
    navigate({ to: "/" });
    return null;
  }
}

export function WebOnly({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  if (window.electron) {
    navigate({ to: "/" });
    return null;
  }
  return children;
}
