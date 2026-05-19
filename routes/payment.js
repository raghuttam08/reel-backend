const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()
const { User } = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'reel_dev_secret_change_in_prod'

// PayPal Configuration
const PAYPAL_API = process.env.PAYPAL_API_URL || 'https://api.sandbox.paypal.com'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_SECRET = process.env.PAYPAL_SECRET

// Middleware to authenticate requests
function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' })

    const token = header.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Helper to get PayPal access token
async function getPayPalAccessToken() {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('PayPal token error:', error)
    throw error
  }
}

// ─── POST /api/payments/create-order ─────────────────────────────────────
// Create PayPal order
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { amount, planType } = req.body
    const user = await User.findById(req.user.id)

    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!amount || !planType)
      return res.status(400).json({ error: 'amount and planType are required' })

    const accessToken = await getPayPalAccessToken()

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: (amount / 100).toString() // Convert from cents to dollars
          },
          description: `Upgrade to ${planType} plan`
        }
      ],
      application_context: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-cancel`,
        brand_name: 'Reel',
        shipping_preference: 'NO_SHIPPING'
      },
      custom_id: `${user._id}|${planType}`
    }

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    })

    const order = await response.json()

    if (order.id) {
      res.json({ id: order.id })
    } else {
      res.status(400).json({ error: order.message || 'Failed to create order' })
    }
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── POST /api/payments/capture-order ────────────────────────────────────
// Capture PayPal order and activate subscription
router.post('/capture-order', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body
    const user = await User.findById(req.user.id)

    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const accessToken = await getPayPalAccessToken()

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const order = await response.json()

    if (order.status === 'COMPLETED') {
      // Parse custom_id to get planType
      const [userId, planType] = order.custom_id.split('|')

      // Update user subscription
      const expiryDate = new Date()
      expiryDate.setMonth(expiryDate.getMonth() + 1)

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        {
          isPremium: true,
          plan: planType,
          subscriptionExpiry: expiryDate,
          paymentIntentId: orderId,
          updatedAt: new Date()
        },
        { new: true }
      )

      res.json({
        success: true,
        plan: planType,
        expiryDate: expiryDate,
        message: `Successfully upgraded to ${planType} plan`
      })
    } else {
      res.status(400).json({
        success: false,
        error: `Order status: ${order.status}`
      })
    }
  } catch (error) {
    console.error('Capture order error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── GET /api/payments/subscription ────────────────────────────────────────
// Get user's subscription status
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) return res.status(404).json({ error: 'User not found' })

    // Check if subscription has expired
    const isExpired = user.subscriptionExpiry && new Date() > user.subscriptionExpiry
    const isPremium = user.isPremium && !isExpired

    res.json({
      isPremium: isPremium,
      plan: isPremium ? user.plan : null,
      expiryDate: isPremium ? user.subscriptionExpiry : null,
      isExpired: isExpired
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── POST /api/payments/cancel ─────────────────────────────────────────────
// Cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.isPremium)
      return res.status(400).json({ error: 'User is not subscribed' })

    // Update user to remove premium status
    await User.findByIdAndUpdate(req.user.id, {
      isPremium: false,
      plan: null,
      subscriptionExpiry: null
    })

    res.json({ success: true, message: 'Subscription cancelled' })
  } catch (error) {
    console.error('Subscription cancellation error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── POST /api/payments/webhook ────────────────────────────────────────────
// PayPal webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.body

    // Verify webhook signature if WEBHOOK_ID is set
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    if (event.event_type === 'CHECKOUT.ORDER.COMPLETED') {
      const orderData = event.resource
      if (orderData.status === 'COMPLETED') {
        const [userId, planType] = orderData.custom_id.split('|')

        // Update user subscription
        const expiryDate = new Date()
        expiryDate.setMonth(expiryDate.getMonth() + 1)

        await User.findByIdAndUpdate(userId, {
          isPremium: true,
          plan: planType,
          subscriptionExpiry: expiryDate,
          paymentIntentId: orderData.id
        })

        console.log(`Payment completed for order ${orderData.id}`)
      }
    }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      console.log(`Order approved: ${event.resource.id}`)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error.message)
    res.status(400).send(`Webhook error: ${error.message}`)
  }
})

module.exports = router
