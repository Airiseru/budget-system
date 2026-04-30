import { createEntityRepository } from "@/src/db/factory"
import SignUpForm from "./SignUpForm"

export default async function SignUpPage() {
    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    
    const departments = (await EntityRepository.getAllDepartments()).filter(entity => entity.status === 'active')
    const agencies = (await EntityRepository.getAllAgencies()).filter(entity => entity.status === 'active')
    const operatingUnits = (await EntityRepository.getAllOperatingUnits()).filter(entity => entity.status === 'active')

    return <SignUpForm departments={departments} agencies={agencies} operatingUnits={operatingUnits} />
}
