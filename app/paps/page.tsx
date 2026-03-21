import { createPapRepository } from '@/src/db/factory'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import Link from "next/link"

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function PapPage() {
    try {
        const data = await PapRepository.getAllPaps()
        console.log(`GET PAPS RESULT in PapPage: ${JSON.stringify(data)}`)
    
        if (data.length === 0) {
            return (
                <div className='m-4'>
                    <ButtonGroup className='my-4'>
                        <ButtonGroup>
                            <Link href="/">
                                <Button variant="outline" aria-label="Go Back">Go Back</Button>
                            </Link>
                        </ButtonGroup>
                        <ButtonGroup>
                            <Link href="/paps/new">
                                <Button variant="outline" >Create New PAP</Button>
                            </Link>
                        </ButtonGroup>
                    </ButtonGroup>
                    <h1>No Paps</h1>
                </div>
            )
        }
    
        return (
            <div className='m-4'>
                <ButtonGroup className='my-4'>
                    <ButtonGroup>
                        <Link href="/">
                            <Button variant="outline" aria-label="Go Back">Go Back</Button>
                        </Link>
                    </ButtonGroup>
                    <ButtonGroup>
                        <Link href="/paps/new">
                            <Button variant="outline" >Create New PAP</Button>
                        </Link>
                    </ButtonGroup>
                </ButtonGroup>

                <h1 className="text-2xl font-bold">All PAPs</h1>
                <div>
                    {data.map((pap) =>
                        <Link href={`/paps/${pap.id}`} key={pap.id}>
                            <div key={pap.id} className="border border-white rounded-md m-2 p-4">
                                <h2 className="font-bold text-sky-500">{pap.title}</h2>
                                <p>{pap.description}</p>
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        )
    } catch (e) {
        console.error(e)
        return (
            <div>
                <h1>An error occurred while loading all PAPs</h1>
            </div>
        )
    }
}