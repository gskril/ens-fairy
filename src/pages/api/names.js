import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import { Parser } from 'json2csv'

const client = new ApolloClient({
  uri: `https://gateway.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/EjtE3sBkYYAwr45BASiFp8cSZEvd1VHTzzYFvJwQUuJx`,
  cache: new InMemoryCache(),
})

export default async function handler(req, res) {
  const { owner, format } = req.query

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

  const domains = data.registrations.map((r) => r.domain)

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
