import * as PostgreAuditRepository from "@/src/db/postgres/repositories/auditRepository";
import * as PostgrePapRepository from "@/src/db/postgres/repositories/papRepository";
import * as PostgreEntityRepository from "@/src/db/postgres/repositories/entityRepository";
import * as PostgreKeyRepository from "@/src/db/postgres/repositories/keyRepository";
import * as PostgreFormRepository from "@/src/db/postgres/repositories/formRepository";
import * as PostgreStaffingRepository from "@/src/db/postgres/repositories/staffingRepository";
import * as PostgreRetireeRepository from "@/src/db/postgres/repositories/retireeRepository";
import * as PostgreSalaryRepository from "@/src/db/postgres/repositories/salaryRepository";
import * as PostgreProposalRepository from "@/src/db/postgres/repositories/proposalRepository";

export function createAuditRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreAuditRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createPapRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgrePapRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createEntityRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreEntityRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createKeyRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreKeyRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createFormRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreFormRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createSalaryRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreSalaryRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createStaffingRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreStaffingRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createRetireeRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreRetireeRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

export function createProposalRepository(dbType: string) {
    switch (dbType) {
        case "postgres":
            return PostgreProposalRepository;
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}
