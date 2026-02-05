import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Use service role for elevated permissions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RedeemResponse = {
  success: boolean
  type?: 'points' | 'partner'
  points_awarded?: number
  partner_id?: string
  description?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RedeemResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  const { code, user_id } = req.body

  // Validate inputs
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid code'
    })
  }

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid user_id'
    })
  }

  try {
    // Call the redeem_code RPC function
    const { data, error } = await supabaseAdmin.rpc('redeem_code', {
      p_code: code.trim(),
      p_user_id: user_id
    })

    if (error) {
      console.error('Redeem error:', error)
      return res.status(500).json({
        success: false,
        error: 'Database error'
      })
    }

    // The RPC returns a JSON object with success/error info
    if (data && typeof data === 'object') {
      if (data.success) {
        return res.status(200).json({
          success: true,
          type: data.type,
          points_awarded: data.points_awarded,
          partner_id: data.partner_id,
          description: data.description
        })
      } else {
        return res.status(400).json({
          success: false,
          error: data.error || 'Redemption failed'
        })
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Unexpected response'
    })
  } catch (err) {
    console.error('API Error:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
