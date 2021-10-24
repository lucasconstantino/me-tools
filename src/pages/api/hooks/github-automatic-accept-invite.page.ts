/* eslint-disable no-console, no-await-in-loop */
import type { NextApiHandler } from 'next'
import type { Endpoints } from '@octokit/types'
import { Octokit } from 'octokit'

const token = process.env.GITHUB_ACCESS_TOKEN

if (!token) {
  throw new Error('GITHUB_ACCESS_TOKEN is not set')
}

const github = new Octokit({ auth: token })

type Invitation =
  Endpoints['GET /user/repository_invitations']['response']['data'][number]

/**
 * Load all pending user invitations.
 */
const loadInvitations = async () => {
  let page = 1
  let paginate = true

  const invitations: Invitation[] = []

  while (paginate) {
    console.log(`Fetching repository invitations: ${page}`)

    const { data } = await github.request('GET /user/repository_invitations', {
      page: page++,
      per_page: 10,
    })

    invitations.push(...data)

    if (data.length === 0) {
      paginate = false
    }
  }

  return invitations
}

/**
 * Accepts a repority invitation.
 */
const acceptInvitation = async (invitation: Invitation) => {
  try {
    console.log(`Accepting invitation: ${invitation.repository.full_name}`)

    await github.request('PATCH /user/repository_invitations/{invitation_id}', {
      invitation_id: invitation.id,
    })
  } catch (err) {
    try {
      await github.request(
        'DELETE /user/repository_invitations/{invitation_id}',
        { invitation_id: invitation.id }
      )
    } catch (_err) {
      // ignore deleting error
    }
  }
}

/**
 * Automatically loop invitations and accept them.
 *
 * Called from Pipedream: https://pipedream.com/@lucasconstantino/p_MOC8QyR/edit?e=1zvi5416LISBBYFaRkPnwAmCdx9
 */
const handler: NextApiHandler = async (_req, res) => {
  try {
    const invitations = await loadInvitations()

    for (const invitation of invitations) {
      await acceptInvitation(invitation)
    }

    return void res.status(200).send('ok')
  } catch (err) {
    const error = err as Error
    console.error(error)
    return void res.status(500).json({ error: error.message })
  }
}

export default handler
