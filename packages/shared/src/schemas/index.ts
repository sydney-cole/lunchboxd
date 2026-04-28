import { z } from 'zod/v4'

export const signUpSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  username: z.string()
    .min(1, 'This field is required.')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
})

export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'This field is required.'),
})

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address.'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
