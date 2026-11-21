import { expect, it } from 'vitest'
import { externalSearchUrl } from './documents'

it('monta a pesquisa externa para o Brasil com busca segura somente a partir do termo informado', () => {
  const url = new URL(externalSearchUrl('  placa mãe & fonte  '))
  expect(url.origin).toBe('https://duckduckgo.com')
  expect(url.searchParams.get('q')).toBe('placa mãe & fonte')
  expect(url.searchParams.get('kl')).toBe('br-pt')
  expect(url.searchParams.get('kp')).toBe('1')
})
