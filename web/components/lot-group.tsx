import React from 'react';
import { Lot } from './lot';

export interface LotProps {
  id: string;
  lotId: string;
  collateralAmount: number;
  collateralToken: string;
  usda: number;
}

export const LotGroup: React.FC<LotProps[]> = ({ lots }) => {
  const lotItems = lots.map((lot: object) =>
    <Lot
      key={`${lot['auction-id']}-${lot['lot-id']}`}
      id={lot['auction-id']}
      lotId={lot['lot-id']}
      collateralAmount={lot['collateral-amount']}
      collateralToken={lot['collateral-token']}
      usda={lot['usda']}
    />
  );

  return (
    <div className="flex flex-col mt-4">
      <div className="min-w-full overflow-hidden overflow-x-auto align-middle shadow sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                Auction ID
              </th>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                Collateral Won
              </th>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                USDA spent
              </th>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lotItems}
          </tbody>
        </table>
      </div>
    </div>
  );
};
