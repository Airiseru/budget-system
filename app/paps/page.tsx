import { createPapRepository } from '@/src/db/factory'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function PapPage() {
    try {
        const data = await PapRepository.getAllPaps()
        console.log(`GET PAPS RESULT: ${JSON.stringify(data)}`)
    
        if (data.length === 0) {
            return (
                <div>
                    <h1>No Paps</h1>
                </div>
            )
        }
    
        return (
            <div>
                <h1>All PAPs</h1>
                <div>
                    {data.map((pap) =>
                        <div key={pap.id} className="border border-white rounded-md m-2 p-4">
                            <h2 className="font-bold text-sky-500">{pap.title}</h2>
                            <p>{pap.description}</p>
                        </div>
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