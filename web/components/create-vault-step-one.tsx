import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AppContext, UserBalanceKeys } from '@common/context';
import { getPrice } from '@common/get-price';
import { getLiquidationPrice, getCollateralToDebtRatio } from '@common/vault-utils';
import { InputAmount } from './input-amount';
import { useLocation } from 'react-router-dom';
import { QuestionMarkCircleIcon, InformationCircleIcon, ExternalLinkIcon } from '@heroicons/react/solid';
import { Tooltip } from '@blockstack/ui';

interface VaultProps {
  setStep: (arg: number) => void;
  setCoinAmounts: (arg: object) => void;
}

export const CreateVaultStepOne: React.FC<VaultProps> = ({ setStep, setCoinAmounts }) => {
  const [state, _] = useContext(AppContext);
  const search = useLocation().search;
  const tokenType = new URLSearchParams(search).get('type') || 'STX-A';
  const tokenName = new URLSearchParams(search).get('token') || 'STX';
  const tokenKey = tokenName.toLowerCase() as UserBalanceKeys;
  const decimals = tokenKey === 'stx' ? 1000000 : 100000000

  const continueVault = () => {
    setCoinAmounts({
      amounts: { collateral: collateralAmount, usda: coinAmount },
      'liquidation-price': liquidationPrice,
      'collateral-to-debt-ratio': collateralToDebt,
      'liquidation-ratio': liquidationRatio,
      'liquidation-penalty': liquidationPenalty,
      'stability-fee-apy': stabilityFeeApy,
      'token-type': tokenType,
      'token-name': tokenName,
      'stack-pox': true,
      'auto-payoff': true
    });
    setStep(1);
  };
  const [collateralAmount, setCollateralAmount] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [maximumToMint, setMaximumToMint] = useState(0);
  const [liquidationPrice, setLiquidationPrice] = useState(0);
  const [collateralToDebt, setCollateralToDebt] = useState(0);
  const [stabilityFeeApy, setStabilityFeeApy] = useState(0);
  const [liquidationPenalty, setLiquidationPenalty] = useState(0);
  const [liquidationRatio, setLiquidationRatio] = useState(0);
  const [price, setPrice] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const maximumCoinsToMint = (value: string) => {
    const minColl = tokenType == 'STX-A' ? 400 : 300;
    const maxRatio = Math.max(minColl, parseInt(liquidationRatio, 10) + 30);
    const uCollateralAmount = parseInt(value * 1000000, 10);
    setMaximumToMint(Math.floor((uCollateralAmount * price * 100) / maxRatio));
  };

  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getPrice(tokenName);
      setPrice(price / 1000000);
    };

    fetchPrice();
  }, []);

  const setCollateralValues = (value:string) => {
    setCollateralAmount(value);
    const error = ['You cannot collateralize more than your balance'];
    if (
      parseFloat(value) < 0 ||
      (tokenKey === 'stx' && parseFloat(value) >= state.balance[tokenKey] / decimals) ||
      (parseFloat(value) > state.balance[tokenKey] / decimals)
    ) {
      if (!errors.includes(error[0])) {
        setErrors(errors.concat(error));
      }
    } else {
      const filteredAry = errors.filter(e => e !== error[0]);
      setErrors(filteredAry);
      maximumCoinsToMint(value);
    }
  }

  const setCollateral = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setCollateralValues(value);
    },
    [state, tokenKey, errors]
  );

  const setCoins = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setCoinAmount(value);
      const error = [`You cannot mint more than ${maximumToMint / 1000000} USDA`];
      const funnyError = [`You need to mint at least a little bit of USDA ;)`];
      const filteredAry = errors.filter(e => (e !== error[0]) && (e !== funnyError[0]));
      if (parseFloat(value) > maximumToMint / 1000000) {
        setErrors(filteredAry.concat(error));
      } else if (value <= parseFloat(maximumToMint / 2500000)) {
        setErrors(filteredAry.concat(funnyError));
      } else {
        setErrors(filteredAry);
      }
    },
    [state, maximumToMint, errors]
  );

  const setMaxBalance = useCallback(() => {
    let balance = state.balance[tokenKey] / decimals;
    if (tokenKey === 'stx') {
      const fee = 2;
      balance -= fee;
    }
    const balanceString = balance.toString();
    setCollateralValues(balanceString);
  }, [state, tokenKey, price]);

  const setMaxCoins = useCallback(() => {
    setCoinAmount((maximumToMint / 1000000).toString());
  }, [state, maximumToMint]);

  useEffect(() => {
    if (collateralAmount && coinAmount) {
      setLiquidationPrice(
        getLiquidationPrice(
          liquidationRatio,
          parseInt(coinAmount, 10),
          parseInt(collateralAmount, 10),
          'stx'
        )
      );
      const ratio = getCollateralToDebtRatio(price * 100, parseInt(coinAmount, 10), parseInt(collateralAmount, 10));
      setCollateralToDebt(ratio);
    }
  }, [price, collateralAmount, coinAmount]);

  useEffect(() => {
    if (state.collateralTypes[tokenType.toUpperCase()]) {
      setStabilityFeeApy(state.collateralTypes[tokenType.toUpperCase()].stabilityFeeApy);
      setLiquidationPenalty(state.collateralTypes[tokenType.toUpperCase()].liquidationPenalty);
      setLiquidationRatio(state.collateralTypes[tokenType.toUpperCase()].liquidationRatio);
    }
  }, [tokenType, state.collateralTypes]);

  return (
    <>
      <section>
        <header className="pb-5 border-b border-gray-200 sm:flex sm:justify-between sm:items-end">
          <div>
            <h2 className="text-2xl font-bold leading-6 text-gray-900 font-headings">Create a new vault</h2>
            <p className="max-w-4xl mt-2 text-sm text-gray-500">
              Deposit {tokenName} and generate USDA
            </p>
          </div>
          <div>
            <div className="flex items-center">
              <div className="w-5.5 h-5.5 rounded-full bg-indigo-200 flex items-center justify-center">
                <QuestionMarkCircleIcon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              </div>
              <a className="inline-flex items-center px-2 text-sm font-medium text-indigo-500 border-transparent hover:border-indigo-300 hover:text-indigo-700" href="https://docs.arkadiko.finance/protocol/vaults" target="_blank" rel="noopener noreferrer">
                Need help with vaults?
                <ExternalLinkIcon className="block w-3 h-3 ml-2" aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        <div className="mt-4 shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 space-y-6 bg-white sm:p-6">
            {errors.length > 0 ? (
              <div className="p-4 border-l-4 border-red-400 bg-red-50">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    {errors.map(txt => (
                      <p className="text-sm text-red-700" key={txt}>
                        {txt}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              ``
            )}
                                            
            <form className="space-y-8 divide-y divide-gray-200">
              <div className="space-y-8 divide-y divide-gray-200">
                <div>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-8">
                    <div className="space-y-6 sm:col-span-3">
                      <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings">
                          How much {tokenName} do you want to collateralize?
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          The amount of {tokenName} you deposit determines how much USDA you can generate.
                        </p>

                        <div className="mt-4">
                          <InputAmount
                            balance={state.balance[tokenKey] / decimals}
                            token={tokenName}
                            inputName="collateral"
                            inputId="collateralAmount"
                            inputValue={collateralAmount}
                            inputLabel={`Collateralize ${tokenName}`}
                            onInputChange={setCollateral}
                            onClickMax={setMaxBalance}
                          />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings">
                          How much USDA would you like to mint?
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Mint an amount that is safely above the liquidation ratio.
                        </p>
                        
                        <div className="mt-4">
                          <InputAmount
                            balance={maximumToMint / 1000000}
                            token="USDA"
                            inputName="coins"
                            inputId="coinsAmount"
                            inputValue={coinAmount}
                            inputLabel="Mint USDA"
                            onInputChange={setCoins}
                            onClickMax={setMaxCoins}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-start-6 sm:col-span-5">
                      <div className="w-full border border-indigo-200 rounded-lg shadow-sm bg-indigo-50">
                        <dl className="sm:divide-y sm:divide-indigo-200">
                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Collateral to Debt Ratio
                              <div className="ml-2">
                                <Tooltip shouldWrapChildren={true} label={`The amount of collateral you deposit in a vault versus the stablecoin debt you are minting against it`}>
                                  <InformationCircleIcon className="block w-5 h-5 text-indigo-400" aria-hidden="true" />
                                </Tooltip>
                              </div>
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              {collateralToDebt > 0 ? ( 
                                <>
                                  {collateralToDebt.toFixed(2)}%
                                </>
                              ) : (
                                <>—</>
                              )}
                            </dd>
                          </div>

                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Liquidation Price
                              <div className="ml-2">
                                <Tooltip shouldWrapChildren={true} label={`The price at which the vault gets tagged for auction`}>
                                  <InformationCircleIcon className="block w-5 h-5 text-indigo-400" aria-hidden="true" />
                                </Tooltip>
                              </div>
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              {liquidationPrice > 0 ? ( 
                                <>
                                  ${liquidationPrice}
                                </>
                              ) : (
                                <>—</>
                              )}
                            </dd>
                          </div>

                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Current {tokenName} Price
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              ${price}
                            </dd>
                          </div>

                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Stability Fee
                              <div className="ml-2">
                                <Tooltip shouldWrapChildren={true} label={`The interest in percentage to borrow USDA`}>
                                  <InformationCircleIcon className="block w-5 h-5 text-indigo-400" aria-hidden="true" />
                                </Tooltip>
                              </div>
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              {stabilityFeeApy / 100}%
                            </dd>
                          </div>

                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Liquidation Ratio
                              <div className="ml-2">
                                <Tooltip shouldWrapChildren={true} label={`The collateral-to-debt ratio when your vault gets liquidated`}>
                                  <InformationCircleIcon className="block w-5 h-5 text-indigo-400" aria-hidden="true" />
                                </Tooltip>
                              </div>
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              {liquidationRatio}%
                            </dd>
                          </div>

                          <div className="p-3 sm:flex sm:items-center sm:flex-1 sm:flex-wrap sm:p-4">
                            <dt className="inline-flex items-center flex-shrink-0 text-sm font-medium text-indigo-500 sm:mr-2">
                              Liquidation Penalty
                              <div className="ml-2">
                                <Tooltip shouldWrapChildren={true} label={`The penalty you pay when your vault gets liquidated`}>
                                  <InformationCircleIcon className="block w-5 h-5 text-indigo-400" aria-hidden="true" />
                                </Tooltip>
                              </div>
                            </dt>
                            <dd className="mt-1 text-sm text-indigo-900 sm:mt-0 sm:ml-auto">
                              {liquidationPenalty}%
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-5">
                <div className="flex justify-end">
                  <button
                    disabled={!coinAmount || errors.length > 0}
                    onClick={() => continueVault()}
                    type="submit"
                    className="inline-flex justify-center px-4 py-2 ml-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};
