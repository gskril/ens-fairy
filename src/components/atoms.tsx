import { Dialog, Typography, mq } from '@ensdomains/thorin'
import styled, { css } from 'styled-components'

export const Layout = styled.div(
  ({ theme }) => css`
    width: 100%;
    min-height: 100svh;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: space-between;
    padding: ${theme.space['4']};
    gap: ${theme.space['12']};

    ${mq.sm.min(css`
      padding: ${theme.space['8']};
    `)}
  `
)

export const Columns = styled.div(
  ({ theme }) => css`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: ${theme.space['6']};
  `
)

export const Container = styled.div(
  ({ theme }) => css`
    margin-left: auto;
    margin-right: auto;
    width: 100%;
    max-width: ${theme.space['192']};
  `
)

export const CardDescription = styled(Typography).attrs({
  asProp: 'p',
  color: 'grey',
})(
  ({ theme }) => css`
    line-height: 1.4;
    text-align: center;

    code {
      font-size: 0.9375rem;
      letter-spacing: -0.0625rem;
      padding: 0.0625rem 0.25rem;
      background-color: ${theme.colors.greySurface};
    }
  `
)

export const StyledDialog = styled(Dialog)(
  ({ theme }) => css`
    width: 100%;

    ${mq.sm.min(css`
      max-width: ${theme.space['112']};
    `)}

    & > div > div {
      width: 100% !important;
    }
  `
)
