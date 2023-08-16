import { lightTheme as theme } from '@ensdomains/thorin'
import Image from 'next/image'

import { shortenAddress } from '../utils'

type Props = {
  label: string
  recipient: {
    address: string
    name: string | undefined
    avatar: string | null | undefined
  }
}

export default function TxSummary({ label, recipient, ...props }: Props) {
  return (
    <>
      <div className="details" {...props}>
        <div className="detail">
          <span className="key">Name</span>
          <span className="value">{label}.eth</span>
        </div>
        <div className="detail">
          <span className="key">Recipient</span>
          <div className="value">
            <a
              className="address-wrapper"
              href={`https://etherscan.io/address/${recipient.address}`}
              target="_blank"
              rel="noreferrer"
            >
              {recipient.name && <span>{recipient.name}</span>}
              <span>{shortenAddress(recipient.address)}</span>
            </a>
            {recipient?.avatar && (
              <div className="image-wrapper">
                <Image
                  src={`http://metadata.ens.domains/mainnet/avatar/${recipient?.name}`}
                  alt=""
                  width={36}
                  height={36}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .details {
          display: flex;
          flex-direction: column;
          gap: ${theme.space[3]};
        }

        .detail {
          display: flex;
          flex-direction: row;
          align-items: center;
          min-height: ${theme.space[14]};
          justify-content: space-between;
          font-size: ${theme.fontSizes.body};
          border-radius: ${theme.radii.extraLarge};
          padding: ${theme.space[3]} ${theme.space[4]};
          border: ${theme.borderWidths['0.375']} solid ${theme.colors.border};
        }

        .key {
          color: ${theme.colors.textSecondary};
          font-weight: ${theme.fontWeights.normal};
        }

        .value {
          display: flex;
          height: max-content;
          align-items: center;
          gap: ${theme.space[3]};
          color: ${theme.colors.textPrimary};
          font-weight: ${theme.fontWeights.bold};
        }

        .address-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .address-wrapper span:nth-child(2) {
          color: ${theme.colors.textSecondary};
          font-weight: ${theme.fontWeights.normal};
          font-size: ${theme.fontSizes.extraSmall};
        }

        .image-wrapper {
          line-height: 1;
          height: 36px;
          background-image: ${theme.colors.gradients.blue};
          box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.1);
          border-radius: 18px;
          overflow: hidden;
        }
      `}</style>
    </>
  )
}
