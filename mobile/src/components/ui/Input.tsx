import { useState, forwardRef } from 'react'
import { View, Text, TextInput, TextInputProps } from 'react-native'

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightSlot?: React.ReactNode
}

/**
 * Input alinhado ao spec do guia (seção 05 — Inputs):
 *  - normal:  border slate2-300 (1.5px) + bg branco
 *  - focused: border brand-500
 *  - error:   border error-500 (#EF4444) com mensagem em error-600
 *  - tipografia DM Sans 14px, texto slate2-900, placeholder slate2-400
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? '#EF4444'
    : focused
    ? '#3B82F6' // brand-500
    : '#CBD5E1' // slate2-300

  return (
    <View>
      {label && (
        <Text
          className="font-sans-medium text-sm mb-1.5"
          style={{ color: error ? '#DC2626' : '#334155' }} // slate2-700
        >
          {label}
        </Text>
      )}
      <View
        className="flex-row items-center bg-white rounded-xl"
        style={{
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: leftIcon ? 0 : 14,
        }}
      >
        {leftIcon && (
          <View className="pl-3.5 pr-2">{leftIcon}</View>
        )}
        <TextInput
          ref={ref}
          className="flex-1 font-sans text-base text-slate2-900"
          style={{ paddingVertical: 12, paddingRight: rightSlot ? 0 : 0 }}
          placeholderTextColor="#94A3B8"
          onFocus={(e) => { setFocused(true); onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); onBlur?.(e) }}
          {...rest}
        />
        {rightSlot && <View className="pr-3.5 pl-2">{rightSlot}</View>}
      </View>
      {error ? (
        <Text className="font-sans text-xs mt-1" style={{ color: '#DC2626' }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="font-sans text-xs mt-1 text-slate2-400">{hint}</Text>
      ) : null}
    </View>
  )
})
