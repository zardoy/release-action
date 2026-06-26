import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/** Import local package from repo */
export default async (importPath: string) => {
    const resolvedImportPath = `${process.cwd()}/node_modules/${importPath}`
    return require(resolvedImportPath)
}
