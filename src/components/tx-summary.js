import Image from 'next/image'
import { formatUsd } from '../lib/utils'
import { lightTheme as theme } from '@ensdomains/thorin'

export default function Details({ estimate, name, recipient, ...props }) {
  return (
    <>
      <div className="details" {...props}>
        <div className="detail">
          <span className="key">Name</span>
          <span className="value">{name}.eth</span>
        </div>
        <div className="detail">
          <span className="key">Recipient</span>
          <div className="value">
            {recipient?.name}
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
        <div className="detail">
          <span className="key">Estimated Cost</span>
          <span className="value">{formatUsd(estimate)}</span>
        </div>
      </div>

      <style jsx>{`
        .details {
          display: flex;
          flex-direction: column;
          gap: ${theme.space[3]};
          padding-bottom: ${theme.space[6]};
        }

        .detail {
          display: flex;
          flex-direction: row;
          align-items: center;
          min-height: ${theme.space[14]};
          justify-content: space-between;
          font-size: ${theme.fontSizes.base};
          border-radius: ${theme.radii.extraLarge};
          padding: ${theme.space[3]} ${theme.space[4]};
          border: ${theme.borderWidths['0.375']} solid
            ${theme.colors.borderSecondary};
        }

        .key {
          color: ${theme.colors.textSecondary};
          font-weight: ${theme.fontWeights.medium};
        }

        .value {
          display: flex;
          height: max-content;
          align-items: center;
          gap: ${theme.space[3]};
          color: ${theme.colors.textPrimary};
          font-weight: ${theme.fontWeights.semiBold};
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
