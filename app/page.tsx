import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function Home() {
  return (
    <main className="m-4">
      <Button variant="outline">
        <Link href="/paps/">PAPs</Link>
      </Button>
    </main>
  );
}
