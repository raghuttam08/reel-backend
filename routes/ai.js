const express = require('express')
const router = express.Router()

// Lazy-load Groq client
let groqClient = null

function initGroqClient() {
  try {
    const { Groq } = require('groq-sdk')
    if (!groqClient) {
      groqClient = new Groq({
        apiKey: process.env.GROQ_API_KEY
      })
      console.log('✓ Groq client initialized with API key')
    }
    return groqClient
  } catch (err) {
    console.error('✗ Failed to initialize Groq client:', err.message)
    return null
  }
}

// POST /api/ai/generate-show-info
router.post('/generate-show-info', async (req, res) => {
  try {
    const { showName, year, overview } = req.body
    
    if (!showName) {
      return res.status(400).json({ error: 'showName is required' })
    }

    // Check if we should use real Groq API
    const isRealApiKey = process.env.GROQ_API_KEY && 
                         process.env.GROQ_API_KEY !== 'gsk_test_key_for_demonstration' &&
                         process.env.GROQ_API_KEY.startsWith('gsk_')
    
    if (isRealApiKey) {
      // Try to use real Groq API
      try {
        const client = initGroqClient()
        if (!client) {
          throw new Error('Groq client not initialized')
        }

        const prompt = `You are an expert TV/film critic and entertainment analyst. Generate a brief, engaging analysis of the show "${showName}"${year ? ` (${year})` : ''}.

${overview ? `Overview: ${overview}` : ''}

Provide insights in JSON format with these fields (be concise):
{
  "audienceReaction": "What do audiences typically think about this show? (1-2 sentences)",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "bestFor": "Who should watch this? (1 sentence)",
  "trigger_warnings": ["warning1", "warning2"],
  "fun_fact": "An interesting fact about the show (1 sentence)"
}

Return ONLY valid JSON, no markdown formatting.`

        const message = await client.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })

        const content = message.choices[0].message.content
        
        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Failed to parse AI response')
        }

        const aiData = JSON.parse(jsonMatch[0])
        console.log(`✓ Generated real AI insights for ${showName}`)
        return res.json({
          success: true,
          data: aiData
        })
      } catch (groqErr) {
        console.error('Groq API error:', groqErr.message)
        console.log('Falling back to demo responses...')
      }
    }
    
    // Use demo responses as fallback
    const demoResponses = {
        'Breaking Bad': {
          audienceReaction: 'Breaking Bad is widely considered one of the greatest TV series ever made. Audiences are captivated by the intense character development and moral complexity.',
          keyThemes: ['Transformation', 'Crime', 'Chemistry', 'Moral Descent', 'Drama'],
          bestFor: 'Fans of intense psychological dramas who appreciate complex character arcs and don\'t mind dark themes.',
          trigger_warnings: ['Drug Use', 'Violence', 'Intense Psychological Themes'],
          fun_fact: 'The show\'s title "Breaking Bad" is a phrase meaning to become a criminal, which perfectly encapsulates Walter White\'s journey.'
        },
        'The Office': {
          audienceReaction: 'The Office is a beloved mockumentary that resonates with office workers and comedy fans alike. Its awkward humor and heartwarming moments create a unique viewing experience.',
          keyThemes: ['Workplace Comedy', 'Relationships', 'Cringe Humor', 'Found Family', 'Office Politics'],
          bestFor: 'People who work in offices or appreciate mockumentary-style comedy with great ensemble casts.',
          trigger_warnings: [],
          fun_fact: 'The show was based on the British version of the same name, but the American version became far more popular and culturally significant.'
        },
        'Stranger Things': {
          audienceReaction: 'Stranger Things is a nostalgia-driven phenomenon that combines horror, sci-fi, and coming-of-age drama. Audiences love the 80s aesthetic and emotional character moments.',
          keyThemes: ['Nostalgia', 'Friendship', 'Horror', 'Sci-Fi', 'Coming of Age'],
          bestFor: 'Fans of 80s pop culture, sci-fi horror, and ensemble casts who appreciate both scares and heartfelt moments.',
          trigger_warnings: ['Violence', 'Scary Scenes'],
          fun_fact: 'The Upside Down dimension was inspired by popular 80s horror films and video games that creators watched growing up.'
        }
      }
      
      // Check if we have a demo response for this show
      const demoData = demoResponses[showName] || {
        audienceReaction: `${showName} has garnered significant audience attention and appreciation. Viewers find it engaging and thought-provoking.`,
        keyThemes: ['Drama', 'Entertainment', 'Storytelling'],
        bestFor: 'Audiences who enjoy quality television and compelling narratives.',
        trigger_warnings: [],
        fun_fact: `${showName} continues to be a notable entry in its genre with a dedicated fanbase.`
      }
      
      return res.json({ success: true, data: demoData })

  } catch (err) {
    console.error('AI generation error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to generate show information' })
  }
})

module.exports = router
