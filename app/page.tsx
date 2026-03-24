import { createEntityRepository } from '@/src/db/factory'
import { Button } from "@/components/ui/button";
import Link from "next/link";

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function Home() {
  const data = await EntityRepository.getAllEntities()
  return (
    <main className="m-4">
      <div className="flex gap-2">
        <Button variant="outline">
          <Link href="/signup/">Sign Up</Link>
        </Button>
        <Button variant="outline">
          <Link href="/login/">Login</Link>
        </Button>
      </div>
      <div>
        {data.map((entity) => (
          <div key={entity.id}>
            <p>{entity.id}: {entity.type}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
