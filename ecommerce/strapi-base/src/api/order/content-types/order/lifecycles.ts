/**
 * Order lifecycles for transactional emails:
 * - confirmation email on create
 * - status change email on update
 * - seller notification on new paid order
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payee',
  shipped: 'Expediee',
  cancelled: 'Annulee',
  refunded: 'Remboursee',
}

const toText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return fallback
}

const SENDER_PLAIN_EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const SENDER_NAMED_EMAIL_RE = /^.+<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>$/

const normalizeSenderFrom = (value: string): string => {
  const compact = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  const unquoted = compact.replace(/^['\"]+|['\"]+$/g, '').trim()

  if (SENDER_PLAIN_EMAIL_RE.test(unquoted) || SENDER_NAMED_EMAIL_RE.test(unquoted)) {
    return unquoted
  }

  const emailMatch = unquoted.match(/([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)/)
  if (!emailMatch) {
    return unquoted
  }

  const email = emailMatch[1]
  const name = unquoted.replace(email, '').trim()
  return name ? `${name} <${email}>` : email
}

const formatAmount = (amount: unknown, currency: unknown): string => {
  const numericAmount =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string'
        ? Number.parseFloat(amount)
        : NaN

  if (!Number.isFinite(numericAmount)) {
    return '-'
  }

  const currencyCode = toText(currency, 'EUR').toUpperCase()

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currencyCode,
    }).format(numericAmount)
  } catch {
    return `${numericAmount.toFixed(2)} ${currencyCode}`
  }
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')

const statusLabel = (status: unknown): string => {
  const key = toText(status)
  return ORDER_STATUS_LABELS[key] ?? key
}

async function sendResendEmail(payload: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.ORDER_EMAIL_FROM
  const testRecipient = process.env.ORDER_EMAIL_TEST_RECIPIENT
  const from = rawFrom ? normalizeSenderFrom(rawFrom) : ''

  const missingEnv: string[] = []
  if (!apiKey) missingEnv.push('RESEND_API_KEY')
  if (!rawFrom) missingEnv.push('ORDER_EMAIL_FROM')

  if (missingEnv.length > 0) {
    strapi.log.warn(
      `[order lifecycle] Email skipped: missing environment variable(s): ${missingEnv.join(', ')}`
    )
    return
  }

  if (!SENDER_PLAIN_EMAIL_RE.test(from) && !SENDER_NAMED_EMAIL_RE.test(from)) {
    strapi.log.warn(
      '[order lifecycle] Email skipped: ORDER_EMAIL_FROM remains invalid after normalization. Expected "email@example.com" or "Name <email@example.com>"'
    )
    return
  }

  const usingResendOnboardingFrom = from
    .toLowerCase()
    .includes('onboarding@resend.dev')

  if (usingResendOnboardingFrom && !testRecipient) {
    strapi.log.warn(
      '[order lifecycle] Email skipped: ORDER_EMAIL_TEST_RECIPIENT is required when ORDER_EMAIL_FROM uses onboarding@resend.dev'
    )
    return
  }

  const recipient = testRecipient || payload.to

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Resend send failed (${response.status}): ${text}`)
  }
}

type OrderLineItem = {
  productName?: string
  quantity?: number
  total?: number
}

type LifecycleOrder = {
  documentId?: string
  customerEmail?: string
  customerName?: string
  status?: string
  total?: number
  currency?: string
  lineItems?: OrderLineItem[]
}

async function sendOrderConfirmationEmail(order: LifecycleOrder): Promise<void> {
  const to = toText(order.customerEmail)
  if (!to) return

  const ref = toText(order.documentId, 'INCONNUE').slice(-8).toUpperCase()
  const customerName = toText(order.customerName, 'Client')
  const total = formatAmount(order.total, order.currency)
  const status = statusLabel(order.status)
  const items = Array.isArray(order.lineItems) ? order.lineItems : []

  const linesHtml =
    items.length > 0
      ? `<ul>${items
          .map((item) => {
            const name = escapeHtml(toText(item.productName, 'Produit'))
            const qty = typeof item.quantity === 'number' ? item.quantity : 1
            return `<li>${name} x ${qty}</li>`
          })
          .join('')}</ul>`
      : '<p>Details disponibles dans votre espace client.</p>'

  const subject = `Commande confirmee #${ref}`
  const html = `
    <p>Bonjour ${escapeHtml(customerName)},</p>
    <p>Votre commande a bien ete enregistree.</p>
    <p><strong>Reference:</strong> #${escapeHtml(ref)}<br/>
    <strong>Statut:</strong> ${escapeHtml(status)}<br/>
    <strong>Total:</strong> ${escapeHtml(total)}</p>
    <p><strong>Articles:</strong></p>
    ${linesHtml}
    <p>Merci pour votre confiance.</p>
  `
  const text = `Bonjour ${customerName},\n\nVotre commande a bien ete enregistree.\nReference: #${ref}\nStatut: ${status}\nTotal: ${total}\n\nMerci pour votre confiance.`

  await sendResendEmail({ to, subject, html, text })
}

async function sendOrderStatusChangedEmail(params: {
  order: LifecycleOrder
  previousStatus: string
}): Promise<void> {
  const to = toText(params.order.customerEmail)
  if (!to) return

  const ref = toText(params.order.documentId, 'INCONNUE').slice(-8).toUpperCase()
  const customerName = toText(params.order.customerName, 'Client')
  const prevLabel = statusLabel(params.previousStatus)
  const nextLabel = statusLabel(params.order.status)

  const subject = `Mise a jour commande #${ref}`
  const html = `
    <p>Bonjour ${escapeHtml(customerName)},</p>
    <p>Le statut de votre commande <strong>#${escapeHtml(ref)}</strong> a ete mis a jour.</p>
    <p><strong>Ancien statut:</strong> ${escapeHtml(prevLabel)}<br/>
    <strong>Nouveau statut:</strong> ${escapeHtml(nextLabel)}</p>
  `
  const text = `Bonjour ${customerName},\n\nLe statut de votre commande #${ref} a ete mis a jour.\nAncien statut: ${prevLabel}\nNouveau statut: ${nextLabel}`

  await sendResendEmail({ to, subject, html, text })
}

function getSellerRecipients(): string[] {
  const raw = toText(process.env.ORDER_SELLER_EMAIL) || toText(process.env.ADMIN_EMAIL)
  if (!raw) {
    strapi.log.info(
      '[order lifecycle] Seller sale email skipped: missing ORDER_SELLER_EMAIL (or ADMIN_EMAIL fallback)'
    )
    return []
  }

  const recipients = raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const validRecipients = recipients.filter((email) => SENDER_PLAIN_EMAIL_RE.test(email))

  if (validRecipients.length === 0) {
    strapi.log.warn(
      '[order lifecycle] Seller sale email skipped: ORDER_SELLER_EMAIL (or ADMIN_EMAIL fallback) is invalid. Expected "email@example.com" or a comma-separated list of emails.'
    )
    return []
  }

  return validRecipients
}

async function sendSellerSaleNotificationEmail(order: LifecycleOrder): Promise<void> {
  const recipients = getSellerRecipients()
  if (recipients.length === 0) return

  const ref = toText(order.documentId, 'INCONNUE').slice(-8).toUpperCase()
  const customerName = toText(order.customerName, 'Client')
  const customerEmail = toText(order.customerEmail, '-')
  const total = formatAmount(order.total, order.currency)
  const items = Array.isArray(order.lineItems) ? order.lineItems : []

  const linesHtml =
    items.length > 0
      ? `<ul>${items
          .map((item) => {
            const name = escapeHtml(toText(item.productName, 'Produit'))
            const qty = typeof item.quantity === 'number' ? item.quantity : 1
            return `<li>${name} x ${qty}</li>`
          })
          .join('')}</ul>`
      : '<p>Aucun detail article disponible.</p>'

  const linesText =
    items.length > 0
      ? items
          .map((item) => {
            const name = toText(item.productName, 'Produit')
            const qty = typeof item.quantity === 'number' ? item.quantity : 1
            return `- ${name} x ${qty}`
          })
          .join('\n')
      : '- Aucun detail article disponible.'

  const subject = `Nouvelle vente #${ref}`
  const html = `
    <p>Bonjour,</p>
    <p>Une nouvelle commande vient d'etre validee.</p>
    <p><strong>Reference:</strong> #${escapeHtml(ref)}<br/>
    <strong>Acheteur:</strong> ${escapeHtml(customerName)} (${escapeHtml(customerEmail)})<br/>
    <strong>Total:</strong> ${escapeHtml(total)}</p>
    <p><strong>Articles:</strong></p>
    ${linesHtml}
  `
  const text = `Bonjour,\n\nUne nouvelle commande vient d'etre validee.\nReference: #${ref}\nAcheteur: ${customerName} (${customerEmail})\nTotal: ${total}\n\nArticles:\n${linesText}`

  await Promise.all(
    recipients.map(async (to) => {
      await sendResendEmail({ to, subject, html, text })
    })
  )
}

export default {
  async beforeUpdate(event: {
    params: {
      where?: { documentId?: string; id?: number }
      data?: { status?: string }
    }
    state: Record<string, unknown>
  }) {
    try {
      const nextStatus = event.params?.data?.status
      const documentId = event.params?.where?.documentId
      const entityId = event.params?.where?.id

      if (!nextStatus) {
        return
      }

      let previousStatus: unknown

      if (documentId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const previousOrder = await (strapi.documents('api::order.order') as any).findOne({
          documentId,
          fields: ['status'],
        })
        previousStatus = previousOrder?.status
      } else if (typeof entityId === 'number') {
        const previousOrder = await strapi.db.query('api::order.order').findOne({
          where: { id: entityId },
          select: ['status'],
        })
        previousStatus = previousOrder?.status
      }

      event.state = event.state || {}
      event.state.previousOrderStatus = previousStatus
    } catch (err) {
      strapi.log.error('[order lifecycle] beforeUpdate error:', err)
    }
  },

  async afterCreate(event: {
    result: {
      documentId: string
      customerEmail?: string
    }
  }) {
    try {
      const orderDocumentId = event.result.documentId

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await (strapi.documents('api::order.order') as any).findOne({
        documentId: orderDocumentId,
        fields: ['documentId', 'customerEmail', 'customerName', 'status', 'total', 'currency'],
        populate: ['lineItems'],
      })

      try {
        await sendOrderConfirmationEmail({
          documentId: order?.documentId,
          customerEmail: order?.customerEmail,
          customerName: order?.customerName,
          status: order?.status,
          total: order?.total,
          currency: order?.currency,
          lineItems: order?.lineItems,
        })
      } catch (emailErr) {
        strapi.log.error('[order lifecycle] confirmation email error:', emailErr)
      }

      try {
        await sendSellerSaleNotificationEmail({
          documentId: order?.documentId,
          customerEmail: order?.customerEmail,
          customerName: order?.customerName,
          total: order?.total,
          currency: order?.currency,
          lineItems: order?.lineItems,
        })
      } catch (emailErr) {
        strapi.log.error('[order lifecycle] seller sale email error:', emailErr)
      }
    } catch (err) {
      strapi.log.error('[order lifecycle] afterCreate error:', err)
    }
  },

  async afterUpdate(event: {
    params?: {
      data?: { status?: string }
    }
    result: {
      documentId?: string
      customerEmail?: string
      customerName?: string
      status?: string
    }
    state?: Record<string, unknown>
  }) {
    try {
      const previousStatus = toText(event.state?.previousOrderStatus)
      const nextStatus = toText(event.result?.status)
      const requestedStatus = toText(event.params?.data?.status)

      if (!requestedStatus) {
        return
      }

      if (!nextStatus || previousStatus === nextStatus) {
        return
      }

      await sendOrderStatusChangedEmail({
        order: {
          documentId: event.result.documentId,
          customerEmail: event.result.customerEmail,
          customerName: event.result.customerName,
          status: nextStatus,
        },
        previousStatus: previousStatus || 'inconnu',
      })
    } catch (err) {
      strapi.log.error('[order lifecycle] afterUpdate error:', err)
    }
  },
}
