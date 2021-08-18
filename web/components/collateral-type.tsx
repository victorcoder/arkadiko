import React from 'react';
import { CollateralTypeProps } from '@common/context';
import { NavLink as RouterLink } from 'react-router-dom'

export const CollateralType: React.FC<CollateralTypeProps> = ({ name, url, token, tokenType, stabilityFeeApy, liquidationRatio, liquidationPenalty, maximumDebt, totalDebt }) => {
  return (
    <tr className="bg-white">
      <td className="px-6 py-4 text-sm text-gray-900 max-w-0 whitespace-nowrap">
        <div className="flex">
          <a href={`${url}`} target="_blank" className="inline-flex space-x-2 text-sm truncate group">
            <svg className="flex-shrink-0 w-5 h-5 text-gray-400 group-hover:text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <p className="text-gray-500 truncate group-hover:text-gray-900">
              {tokenType} ({name})
            </p>
          </a>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-left text-gray-500 whitespace-nowrap">
        <span className="text-gray-900">{stabilityFeeApy / 100}%</span>
      </td>
      <td className="px-6 py-4 text-sm text-left text-gray-500 whitespace-nowrap">
        <span className="text-gray-900">{liquidationRatio}%</span>
      </td>
      <td className="px-6 py-4 text-sm text-left text-gray-500 whitespace-nowrap">
        <span className="text-gray-900">{liquidationPenalty}%</span>
      </td>
      <td className="px-6 py-4 text-sm text-left text-gray-500 whitespace-nowrap">
        <span className="text-gray-900">${maximumDebt / 1000000000000} million</span>
      </td>
      <td className="px-6 py-4 text-sm text-left text-gray-500 whitespace-nowrap">
        <span className="text-gray-900">${(totalDebt / 1000000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
      </td>
      <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
        <RouterLink to={`/vaults/new?type=${tokenType}&token=${token}`} exact className="text-indigo-600 hover:text-indigo-900">
          New Vault
        </RouterLink>
      </td>
    </tr>
  );
};
