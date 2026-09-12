import { createFileRoute } from "@tanstack/react-router";
import { PowerBlankApp } from "@/components/pb/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <PowerBlankApp />;
}
