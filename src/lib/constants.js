export const ensRegistrarAddr = '0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5' // same for Mainnet, Goerli

export const ensRegistrarAbi = require('./ens-registrar-abi.json')

export const ensRegistrarConfig = {
  addressOrName: ensRegistrarAddr,
  contractInterface: ensRegistrarAbi,
}

export const ensResolver = '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41'
export const ensResolverGoerli = '0x2800Ec5BAB9CE9226d19E0ad5BC607e3cfC4347E'
