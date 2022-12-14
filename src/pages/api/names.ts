import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import { Parser } from 'json2csv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'

const schema = z.object({
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  format: z.string().optional(),
})

const client = new ApolloClient({
  uri: `https://gateway.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/EjtE3sBkYYAwr45BASiFp8cSZEvd1VHTzzYFvJwQUuJx`,
  cache: new InMemoryCache(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const safeParse = schema.safeParse(req.query)

  if (!safeParse.success) {
    return res.status(400).send({ error: safeParse.error })
  }

  const { owner, format } = schema.parse(req.query)

  if (!owner) {
    return res.status(400).send({ error: 'Missing `owner` parameter' })
  }

  const { data } = await client.query({
    query: gql`
      {
        registrations(
          where: { registrant: "${owner.toLowerCase()}" },
          first: 500
        ) {
          domain {
            id
            name
          }
        }
      }
    `,
  })

  const registrations = data.registrations as {
    domain: {
      id: string
      name: string
    }
  }[]

  const domains = registrations.map((r) => r.domain)

  if (format === 'csv') {
    const parser = new Parser({
      fields: ['name'],
    })
    const csv = parser.parse(domains)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=domains.csv')
    return res.send(csv)
  }

  res.status(200).json({
    domains,
    meta: {
      length: domains.length,
    },
  })
}
