/** Import local package from repo */
export default async (importPath: string) => {
    const resolvedImportPath = `${process.cwd()}/node_modules/${importPath}`
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(resolvedImportPath)
}
