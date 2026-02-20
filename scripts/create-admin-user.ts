/**
 * Script to create an admin user in Supabase Auth
 * 
 * Run this script to create your first admin user:
 * node --loader ts-node/esm scripts/create-admin-user.ts
 * 
 * Or just create a user directly from the Supabase dashboard:
 * 1. Go to your Supabase project dashboard
 * 2. Click "Authentication" > "Users"
 * 3. Click "Add user" > "Create new user"
 * 4. Enter email and password
 * 5. User will be created and can login immediately
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  const email = process.argv[2] || 'admin@avigest.com'
  const password = process.argv[3] || 'admin123'

  console.log(`Creating admin user: ${email}`)

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email so user can login immediately
  })

  if (error) {
    console.error('Error creating user:', error.message)
    process.exit(1)
  }

  console.log('✅ Admin user created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('\nYou can now login at /auth/login')
}

createAdminUser()
