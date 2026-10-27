/** Compiles contracts/src with solc-js into contracts/out. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import solc from 'solc'

const srcDir = join(import.meta.dirname, 'src')
const outDir = join(import.meta.dirname, 'out')

const sources = Object.fromEntries(
  readdirSync(srcDir)
    .filter((file) => file.endsWith('.sol'))
    .map((file) => [
      file,
      { content: readFileSync(join(srcDir, file), 'utf8') },
    ])
)

const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: 'Solidity',
      sources,
      settings: {
        evmVersion: 'cancun',
        optimizer: { enabled: true, runs: 10_000 },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
          },
        },
      },
    })
  )
)

const errors = (output.errors ?? []).filter((e: any) => e.severity === 'error')
for (const e of output.errors ?? []) console.error(e.formattedMessage)
if (errors.length) process.exit(1)

mkdirSync(outDir, { recursive: true })
for (const [file, contracts] of Object.entries<any>(output.contracts)) {
  for (const [name, artifact] of Object.entries<any>(contracts)) {
    const bytecode = `0x${artifact.evm.bytecode.object}` as const
    writeFileSync(
      join(outDir, `${name}.json`),
      JSON.stringify(
        {
          contractName: name,
          sourceName: file,
          compiler: solc.version(),
          abi: artifact.abi,
          bytecode,
          deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
        },
        null,
        2
      ) + '\n'
    )
    console.log(`${name}: ${(bytecode.length - 2) / 2} bytes`)
  }
}
