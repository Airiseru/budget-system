import { createEntityRepository } from "@/src/db/factory"
import SignUpForm from "./SignUpForm"

export default async function SignUpPage() {
    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    
    // Fetch departments and agencies
    const departments = await EntityRepository.getAllDepartments()
    const agencies = await EntityRepository.getAllAgencies()

    // Pass departments and agencies to form
    return <SignUpForm departments={departments} agencies={agencies} />
}