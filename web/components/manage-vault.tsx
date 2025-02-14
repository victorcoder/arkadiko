import React, { useContext, useEffect, useState } from 'react';
import { Modal, Tooltip } from '@blockstack/ui';
import { XIcon } from '@heroicons/react/outline';
import { InformationCircleIcon } from '@heroicons/react/solid';
import { Container } from './home';
import { stacksNetwork as network } from '@common/utils';
import { useSTXAddress } from '@common/use-stx-address';
import { useConnect } from '@stacks/connect-react';
import {
  AnchorMode, uintCV, stringAsciiCV, contractPrincipalCV, cvToJSON,
  callReadOnlyFunction, makeStandardFungiblePostCondition,
  createAssetInfo, FungibleConditionCode, makeStandardSTXPostCondition } from '@stacks/transactions';
import { AppContext, CollateralTypeProps } from '@common/context';
import { getCollateralToDebtRatio } from '@common/get-collateral-to-debt-ratio';
import { debtClass, VaultProps } from './vault';
import { getPrice } from '@common/get-price';
import { getLiquidationPrice, availableCollateralToWithdraw, availableCoinsToMint } from '@common/vault-utils';
import { Redirect } from 'react-router-dom';
import { resolveReserveName, tokenTraits } from '@common/vault-utils';
import BN from 'bn.js';
import { tokenList } from '@components/token-swap-list';
import { InputAmount } from './input-amount';
import { getRPCClient } from '@common/utils';
import { microToReadable } from '@common/vault-utils';

export const ManageVault = ({ match }) => {
  const { doContractCall } = useConnect();
  const senderAddress = useSTXAddress();
  const [state, setState] = useContext(AppContext);
  const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || '';

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [extraCollateralDeposit, setExtraCollateralDeposit] = useState('');
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [collateralToWithdraw, setCollateralToWithdraw] = useState('');
  const [maximumCollateralToWithdraw, setMaximumCollateralToWithdraw] = useState(0);
  const [usdToMint, setUsdToMint] = useState('');
  const [usdToBurn, setUsdToBurn] = useState('');
  const [reserveName, setReserveName] = useState('');
  const [vault, setVault] = useState<VaultProps>();
  const [price, setPrice] = useState(0);
  const [collateralType, setCollateralType] = useState<CollateralTypeProps>();
  const [isVaultOwner, setIsVaultOwner] = useState(false);
  const [stabilityFee, setStabilityFee] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [unlockBurnHeight, setUnlockBurnHeight] = useState(0);
  const [closingVault, setClosingVault] = useState(false);
  const [enabledStacking, setEnabledStacking] = useState(true);
  const [startedStacking, setStartedStacking] = useState(true);
  const [canWithdrawCollateral, setCanWithdrawCollateral] = useState(false);
  const [canUnlockCollateral, setCanUnlockCollateral] = useState(false);
  const [canStackCollateral, setCanStackCollateral] = useState(false);
  const [decimals, setDecimals] = useState(1000000);

  useEffect(() => {
    const fetchVault = async () => {
      const serializedVault = await callReadOnlyFunction({
        contractAddress,
        contractName: "arkadiko-freddie-v1-1",
        functionName: "get-vault-by-id",
        functionArgs: [uintCV(match.params.id)],
        senderAddress: senderAddress || '',
        network: network,
      });
      const data = cvToJSON(serializedVault).value;

      if (data['id'].value !== 0) {
        setVault({
          id: data['id'].value,
          owner: data['owner'].value,
          collateral: data['collateral'].value,
          collateralType: data['collateral-type'].value,
          collateralToken: data['collateral-token'].value,
          isLiquidated: data['is-liquidated'].value,
          auctionEnded: data['auction-ended'].value,
          leftoverCollateral: data['leftover-collateral'].value,
          debt: data['debt'].value,
          stackedTokens: data['stacked-tokens'].value,
          stackerName: data['stacker-name'].value,
          revokedStacking: data['revoked-stacking'].value,
          collateralData: {},
        });
        setReserveName(resolveReserveName(data['collateral-token'].value));
        setAuctionEnded(data['auction-ended'].value);
        setIsVaultOwner(data['owner'].value === senderAddress);

        let price = await getPrice(data['collateral-token'].value);
        setPrice(price);

        const type = await callReadOnlyFunction({
          contractAddress,
          contractName: "arkadiko-collateral-types-v1-1",
          functionName: "get-collateral-type-by-name",
          functionArgs: [stringAsciiCV(data['collateral-type'].value)],
          senderAddress: senderAddress || '',
          network: network,
        });
        const json = cvToJSON(type.value);
        setCollateralType({
          name: json.value['name'].value,
          token: json.value['token'].value,
          tokenType: json.value['token-type'].value,
          url: json.value['url'].value,
          totalDebt: json.value['total-debt'].value,
          collateralToDebtRatio: json.value['collateral-to-debt-ratio'].value,
          liquidationPenalty: json.value['liquidation-penalty'].value / 100,
          liquidationRatio: json.value['liquidation-ratio'].value,
          maximumDebt: json.value['maximum-debt'].value,
          stabilityFee: json.value['stability-fee'].value,
          stabilityFeeApy: json.value['stability-fee-apy'].value
        });
      }
    }

    fetchVault();
  }, [match.params.id]);

  useEffect(() => {
    const fetchFees = async () => {
      const feeCall = await callReadOnlyFunction({
        contractAddress,
        contractName: "arkadiko-freddie-v1-1",
        functionName: "get-stability-fee-for-vault",
        functionArgs: [
          uintCV(vault?.id),
          contractPrincipalCV(contractAddress || '', 'arkadiko-collateral-types-v1-1')
        ],
        senderAddress: contractAddress || '',
        network: network,
      });
      const fee = cvToJSON(feeCall);
      setStabilityFee(fee.value.value);
      setTotalDebt(outstandingDebt() + (fee.value.value / 1000000));
    };

    const fetchStackerHeight = async () => {
      if (vault?.stackedTokens === 0 && vault?.revokedStacking) {
        setEnabledStacking(false);
      }

      const name = vault?.stackerName;
      let contractName = 'arkadiko-stacker-v1-1';
      if (name === 'stacker-2') {
        contractName = 'arkadiko-stacker-2-v1-1';
      } else if (name === 'stacker-3') {
        contractName = 'arkadiko-stacker-3-v1-1';
      } else if (name === 'stacker-4') {
        contractName = 'arkadiko-stacker-4-v1-1';
      }

      const call = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: "get-stacking-unlock-burn-height",
        functionArgs: [],
        senderAddress: contractAddress || '',
        network: network
      });
      const unlockBurnHeight = cvToJSON(call).value.value;
      setUnlockBurnHeight(unlockBurnHeight);
      if (Number(unlockBurnHeight) === 0) {
        setStartedStacking(false);
        if (Number(vault?.stackedTokens) === 0) {
          setCanWithdrawCollateral(true);
        }
        if (vault?.revokedStacking) {
          setCanUnlockCollateral(true);
        }
        return;
      }

      const client = getRPCClient();
      const response = await fetch(`${client.url}/v2/info`, { credentials: 'omit' });
      const data = await response.json();
      const currentBurnHeight = data['stable_burn_block_height'];
      if (unlockBurnHeight > currentBurnHeight) {
        setCanWithdrawCollateral(true);
      }
    };

    if (vault?.id) {
      if (vault['collateralType'].toLowerCase().includes('stx')) {
        setCanStackCollateral(true);
      }
      setDecimals(vault['collateralType'].toLowerCase().includes('stx') ? 1000000 : 100000000);
      fetchFees();
      fetchStackerHeight();
    }
  }, [vault]);

  useEffect(() => {
    if (vault && collateralType?.collateralToDebtRatio) {
      if (Number(vault.stackedTokens) === 0) {
        setMaximumCollateralToWithdraw(availableCollateralToWithdraw(price, collateralLocked(), outstandingDebt(), collateralType?.collateralToDebtRatio));
      } else {
        setMaximumCollateralToWithdraw(0);
      }
    }
  }, [collateralType?.collateralToDebtRatio, price]);

  const callBurn = async () => {
    const token = tokenTraits[vault['collateralToken'].toLowerCase()]['name'];
    const totalToBurn = Number(usdToBurn) + (2 * (stabilityFee / 1000000));
    const postConditions = [
      makeStandardFungiblePostCondition(
        senderAddress || '',
        FungibleConditionCode.LessEqual,
        uintCV(parseInt(totalToBurn * 1000000, 10)).value,
        createAssetInfo(
          contractAddress,
          'usda-token',
          'usda'
        )
      )
    ];

    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'burn',
      functionArgs: [
        uintCV(match.params.id),
        uintCV(parseFloat(usdToBurn) * 1000000),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', reserveName),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', token),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-collateral-types-v1-1')
      ],
      postConditions,
      onFinish: data => {
        console.log('finished burn!', data);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
        setShowBurnModal(false);
      },
      anchorMode: AnchorMode.Any
    });
  };
  let debtRatio = 0;
  if (match.params.id) {
    debtRatio = getCollateralToDebtRatio(match.params.id)?.collateralToDebt;
  }

  useEffect(() => {
    if (state.currentTxStatus === 'success') {
      if (closingVault) {
        window.location.href = '/vaults';
      } else {
        window.location.reload();
      }
    }
  }, [state.currentTxStatus]);

  const addDeposit = async () => {
    if (!extraCollateralDeposit) {
      return;
    }
    const token = tokenTraits[vault['collateralToken'].toLowerCase()]['name'];

    let postConditions:any[] = [];
    if (vault['collateralToken'].toLowerCase() === 'stx') {
      postConditions = [
        makeStandardSTXPostCondition(
          senderAddress || '',
          FungibleConditionCode.Equal,
          new BN(parseFloat(extraCollateralDeposit) * 1000000)
        )
      ];
    } else {
      // postConditions = [
      //   makeStandardFungiblePostCondition(
      //     senderAddress || '',
      //     FungibleConditionCode.Equal,
      //     new BN(parseFloat(extraCollateralDeposit) * 1000000),
      //     createAssetInfo(
      //       "CONTRACT_ADDRESS",
      //       token,
      //       vault['collateralToken'].toUpperCase()
      //     )
      //   )
      // ];
    }

    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'deposit',
      functionArgs: [
        uintCV(match.params.id),
        uintCV(parseFloat(extraCollateralDeposit) * 1000000),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', reserveName),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', token),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-collateral-types-v1-1')
      ],
      postConditions,
      onFinish: data => {
        console.log('finished deposit!', data);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
        setShowDepositModal(false);
      },
      anchorMode: AnchorMode.Any
    });
  };

  const liquidationPrice = () => {
    if (vault) {
      // (liquidationRatio * coinsMinted) / collateral = rekt
      return getLiquidationPrice(
        collateralType?.liquidationRatio,
        vault['debt'],
        vault['collateral'],
        vault['collateralType']
      );
    }

    return 0;
  }

  const collateralLocked = () => {
    if (vault) {
      const decimals = vault['collateralType'].toLowerCase().includes('stx') ? 1000000 : 100000000;
      return vault['collateral'] / decimals;
    }

    return 0;
  }

  const outstandingDebt = () => {
    if (vault) {
      return vault.debt / 1000000;
    }

    return 0;
  }

  const onInputChange = (event: { target: { value: any, name: any; }; }) => {
    const value = event.target.value;
    if (event.target.name === 'depositCollateral') {
      setExtraCollateralDeposit(value);
    } else if (event.target.name === 'mintDebt') {
      setUsdToMint(value);
    } else if (event.target.name === 'burnDebt') {
      setUsdToBurn(value);
    } else {
      setCollateralToWithdraw(value);
    }
  };

  const callMint = async () => {
    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'mint',
      functionArgs: [
        uintCV(match.params.id),
        uintCV(parseFloat(usdToMint) * 1000000),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', reserveName),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-collateral-types-v1-1'),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-oracle-v1-1')
      ],
      onFinish: data => {
        console.log('finished mint!', data, data.txId);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
        setShowMintModal(false);
      },
      anchorMode: AnchorMode.Any
    });
  };

  const callToggleStacking = async () => {
    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'toggle-stacking',
      functionArgs: [uintCV(match.params.id)],
      onFinish: data => {
        console.log('finished toggling stacking!', data, data.txId);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
      },
      anchorMode: AnchorMode.Any
    });
  };

  const stackCollateral = async () => {
    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'stack-collateral',
      functionArgs: [uintCV(match.params.id)],
      onFinish: data => {
        console.log('finished stacking!', data, data.txId);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
      },
      anchorMode: AnchorMode.Any
    });
  };

  const unlockCollateral = async () => {
    const name = vault?.stackerName;
    let contractName = 'arkadiko-stacker-v1-1';
    if (name === 'stacker-2') {
      contractName = 'arkadiko-stacker-2-v1-1';
    } else if (name === 'stacker-3') {
      contractName = 'arkadiko-stacker-3-v1-1';
    } else if (name === 'stacker-4') {
      contractName = 'arkadiko-stacker-4-v1-1';
    }

    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName,
      functionName: 'enable-vault-withdrawals',
      functionArgs: [uintCV(match.params.id)],
      onFinish: data => {
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
      },
      anchorMode: AnchorMode.Any
    });
  };

  const callWithdraw = async () => {
    if (parseFloat(collateralToWithdraw) > maximumCollateralToWithdraw) {
      return;
    }

    const token = tokenTraits[vault['collateralToken'].toLowerCase()]['name'];
    await doContractCall({
      network,
      contractAddress,
      stxAddress: senderAddress,
      contractName: "arkadiko-freddie-v1-1",
      functionName: 'withdraw',
      functionArgs: [
        uintCV(match.params.id),
        uintCV(parseFloat(collateralToWithdraw) * 1000000),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', reserveName),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', token),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-collateral-types-v1-1'),
        contractPrincipalCV(process.env.REACT_APP_CONTRACT_ADDRESS || '', 'arkadiko-oracle-v1-1')
      ],
      postConditionMode: 0x01,
      onFinish: data => {
        console.log('finished withdraw!', data);
        setState(prevState => ({ ...prevState, currentTxId: data.txId, currentTxStatus: 'pending' }));
        setShowWithdrawModal(false);
      },
      anchorMode: AnchorMode.Any
    });
  };

  const depositMaxAmount = () => {
    setExtraCollateralDeposit((state.balance['stx'] / 1000000) - 1);
  };

  const mintMaxAmount = () => {
    setUsdToMint(
      availableCoinsToMint(
        price,
        collateralLocked(),
        outstandingDebt(),
        collateralType?.collateralToDebtRatio,
        vault?.collateralToken
      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    );
  };
  
  const burnMaxAmount = () => {
    setUsdToBurn(outstandingDebt());
  };

  const withdrawMaxAmount = () => {
    return setCollateralToWithdraw(String(maximumCollateralToWithdraw));
  };

  return (
    <Container>
      {auctionEnded && <Redirect to="/vaults" />}

      <Modal isOpen={showDepositModal}>
        <div className="flex px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="inline-block px-2 pt-5 pb-4 overflow-hidden text-left align-bottom bg-white rounded-lg sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
              <button
                type="button"
                className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowDepositModal(false)}
              >
                <span className="sr-only">Close</span>
                <XIcon className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-center mx-auto rounded-full">
              <img className="w-10 h-10 rounded-full" src={tokenList[2].logo} alt="" />
            </div>
            <div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings" id="modal-headline">
                  Deposit Extra Collateral
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Choose how much extra collateral you want to post. You have a balance of {state.balance[vault?.collateralToken.toLowerCase()] / decimals} {vault?.collateralToken.toUpperCase()}.
                  </p>
                  <p className="text-sm text-gray-500">
                    We will automatically harvest any DIKO you are eligible for when depositing.
                  </p>

                  <div className="mt-6">
                    <InputAmount
                      balance={(state.balance[vault?.collateralToken.toLowerCase()] / decimals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      token={vault?.collateralToken.toUpperCase()}
                      inputName="depositCollateral"
                      inputId="depositExtraStxAmount"
                      inputValue={extraCollateralDeposit}
                      inputLabel="Deposit Extra Collateral"
                      onInputChange={onInputChange}
                      onClickMax={depositMaxAmount}
                    />
                  </div>

                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => addDeposit()}
              >
                Add deposit
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setShowDepositModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showWithdrawModal}>
        <div className="flex px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="inline-block px-2 pt-5 pb-4 overflow-hidden text-left align-bottom bg-white rounded-lg sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
              <button
                type="button"
                className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowWithdrawModal(false)}
              >
                <span className="sr-only">Close</span>
                <XIcon className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-center mx-auto rounded-full">
              <img className="w-10 h-10 rounded-full" src={tokenList[1].logo} alt="" />
            </div>
            <div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings" id="modal-headline">
                  Withdraw Collateral
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Choose how much collateral you want to withdraw. You can withdraw a maximum of {maximumCollateralToWithdraw} {vault?.collateralToken.toUpperCase()}.
                  </p>
                  <p className="text-sm text-gray-500">
                    We will automatically harvest any DIKO you are eligible for when withdrawing.
                  </p>

                  <div className="mt-6">
                    <InputAmount
                      balance={maximumCollateralToWithdraw}
                      token={vault?.collateralToken.toUpperCase()}
                      inputName="withdrawCollateral"
                      inputId="withdrawCollateralAmount"
                      inputValue={collateralToWithdraw}
                      inputLabel="Withdraw Collateral"
                      onInputChange={onInputChange}
                      onClickMax={withdrawMaxAmount}
                    />
                  </div>

                </div>
              </div>
            </div>

            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => callWithdraw()}
              >
                Withdraw
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setShowWithdrawModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showMintModal}>
        <div className="flex px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="inline-block px-2 pt-5 pb-4 overflow-hidden text-left align-bottom bg-white rounded-lg sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
              <button
                type="button"
                className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowMintModal(false)}
              >
                <span className="sr-only">Close</span>
                <XIcon className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-center mx-auto rounded-full">
              <img className="w-10 h-10 rounded-full" src={tokenList[0].logo} alt="" />
            </div>
            <div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings" id="modal-headline">
                  Mint extra USDA
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Choose how much extra USDA you want to mint. You can mint a maximum of {availableCoinsToMint(price, collateralLocked(), outstandingDebt(), collateralType?.collateralToDebtRatio, vault?.collateralToken).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDA.
                  </p>

                  <div className="mt-6">
                    <InputAmount
                      balance={availableCoinsToMint(price, collateralLocked(), outstandingDebt(), collateralType?.collateralToDebtRatio, vault?.collateralToken).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      token="USDA"
                      inputName="mintDebt"
                      inputId="mintUSDAAmount"
                      inputValue={usdToMint}
                      inputLabel="Mint USDA"
                      onInputChange={onInputChange}
                      onClickMax={mintMaxAmount}
                    />
                  </div>

                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => callMint()}
              >
                Mint
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setShowMintModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showBurnModal}>
        <div className="flex px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="inline-block px-2 pt-5 pb-4 overflow-hidden text-left align-bottom bg-white rounded-lg sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
              <button
                type="button"
                className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowBurnModal(false)}
              >
                <span className="sr-only">Close</span>
                <XIcon className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-center mx-auto rounded-full">
              <img className="w-10 h-10 rounded-full" src={tokenList[0].logo} alt="" />
            </div>
            <div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg font-medium leading-6 text-gray-900 font-headings" id="modal-headline">
                  Burn USDA
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Choose how much USDA you want to burn. If you burn all USDA, your vault will be closed.
                  </p>

                  <div className="mt-6">
                    <InputAmount
                      balance={(state.balance['usda'] / 1000000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      token="USDA"
                      inputName="burnDebt"
                      inputId="burnAmount"
                      inputValue={usdToBurn}
                      inputLabel="Burn USDA"
                      onInputChange={onInputChange}
                      onClickMax={burnMaxAmount}
                    />
                  </div>

                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => callBurn()}
              >
                Burn
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setShowBurnModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <main className="flex-1 py-12">
        <section>
          <header className="pb-5 border-b border-gray-200">
            <h2 className="text-xl font-bold leading-6 text-gray-900 font-headings">
              {vault?.collateralToken.toUpperCase()}/USDA Vault #{match.params.id}
            </h2>
          </header>
          
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="mt-4 divide-y divide-gray-200 shadow sm:rounded-md bg-white sm:overflow-hidden sm:min-h-[480px]">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-2xl font-normal leading-6 text-gray-900 font-headings">
                    Supply
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">Manage your collateral. Deposit extra {vault?.collateralToken.toUpperCase()}. Update your stacking status.</p>
                </div>
                <div className="px-4 py-5 space-y-6 bg-white divide-y divide-gray-200 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-semibold leading-none">{collateralLocked()} <span className="text-sm font-normal">{vault?.collateralToken.toUpperCase()}</span></p>
                      <p className="text-base font-normal leading-6 text-gray-500">{vault?.collateralToken.toUpperCase()} Locked</p>
                    </div>

                    {isVaultOwner ? (
                      <button 
                        type="button" 
                        className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => setShowDepositModal(true)}>
                        Deposit
                      </button>
                    ) : null }
                  </div>

                  {canStackCollateral ? (
                    <div className="pt-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold leading-none">Stacking</p>
                          {enabledStacking ? (
                            <p className="text-base font-normal leading-6 text-green-500">Enabled</p>
                          ) : (
                            <p className="text-base font-normal leading-6 text-red-500">Disabled</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-lg font-semibold leading-none">{microToReadable(vault?.stackedTokens)} <span className="text-sm font-normal">{vault?.collateralToken.toUpperCase()}</span></p>
                            <p className="text-base font-normal leading-6 text-gray-500">Currently stacking</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold leading-none">{state.endDate}</p>
                            <p className="text-base font-normal leading-6 text-gray-500">End of current cycle</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null }
                  
                  <div className="pt-6">
                    <div className="sm:flex sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold leading-none">{maximumCollateralToWithdraw} <span className="text-sm font-normal">{vault?.collateralToken.toUpperCase()}</span></p>
                        <p className="text-base font-normal leading-6 text-gray-500">Able to withdraw</p>
                      </div>

                      {isVaultOwner && canWithdrawCollateral ? (
                        <button 
                          type="button" 
                          className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => setShowWithdrawModal(true)}>
                          Withdraw
                        </button>
                      ) : null }
                      {isVaultOwner && canUnlockCollateral && vault?.stackedTokens > 0 ? (
                        <button 
                        type="button" 
                        className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => unlockCollateral()}>
                          Unlock Collateral
                      </button>
                      ) : null }
                    </div>
                    
                    {canStackCollateral && isVaultOwner && vault?.stackedTokens > 0 && !vault?.revokedStacking && !canWithdrawCollateral ? (
                      // user has indicated they want to stack their STX tokens
                      <div className="p-4 mt-4 border-l-4 border-blue-400 rounded-tr-md rounded-br-md bg-blue-50">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 ml-3 md:flex md:justify-between">
                            {startedStacking ? (
                              <>
                              <p className="text-sm text-blue-700">
                                You cannot withdraw your collateral since it is stacked until Bitcoin block {unlockBurnHeight}. Unstack your collateral to unlock it for withdrawal.
                              </p>
                              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                                <button 
                                  type="button" 
                                  className="font-medium text-blue-700 whitespace-nowrap hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  onClick={() => callToggleStacking()}>
                                  Unstack <span aria-hidden="true">&rarr;</span>
                                </button>
                              </p>
                              </>
                            ) : (
                              <>
                              <p className="text-sm text-blue-700">
                                The next stacking cycle has not started yet. You can still choose to opt-out of stacking your STX tokens. If you do so, you will not earn a yield on your vault.
                              </p>
                              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                                <button 
                                  type="button" 
                                  className="font-medium text-blue-700 whitespace-nowrap hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  onClick={() => callToggleStacking()}>
                                  Do not stack <span aria-hidden="true">&rarr;</span>
                                </button>
                              </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : canStackCollateral && isVaultOwner && vault?.stackedTokens > 0 && vault?.revokedStacking ? (
                      <div className="p-4 mt-4 border-l-4 border-blue-400 rounded-tr-md rounded-br-md bg-blue-50">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 ml-3 md:flex md:justify-between">
                            <p className="text-sm text-blue-700">You have unstacked your collateral, you can choose to stack again.</p>
                            {isVaultOwner ? (
                              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                                <button 
                                  type="button" 
                                  className="font-medium text-blue-700 whitespace-nowrap hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  onClick={() => callToggleStacking()}>
                                  Restack <span aria-hidden="true">&rarr;</span>
                                </button>
                              </p>
                            ) : null }
                          </div>
                        </div>
                      </div>
                    ) : canStackCollateral && isVaultOwner ? (
                      <div className="p-4 mt-4 border-l-4 border-blue-400 rounded-tr-md rounded-br-md bg-blue-50">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 ml-3 md:flex md:justify-between">
                            <p className="text-sm text-blue-700">You are not stacking your collateral.</p>
                              {isVaultOwner ? (
                              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                                <button 
                                  type="button" 
                                  className="font-medium text-blue-700 whitespace-nowrap hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  onClick={() => stackCollateral()}>
                                  Stack <span aria-hidden="true">&rarr;</span>
                                </button>
                              </p>
                            ) : null }
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 divide-y divide-gray-200 shadow sm:rounded-md bg-white sm:overflow-hidden sm:min-h-[480px]">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-2xl font-normal leading-6 text-gray-900 font-headings">
                    Mint
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">Manage your loan. Get extra USDA. Pay it back.</p>
                </div>
                <div className="relative px-4 py-5 space-y-6 bg-white divide-y divide-gray-200 sm:p-6">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold leading-none">{availableCoinsToMint(price, collateralLocked(), outstandingDebt(), collateralType?.collateralToDebtRatio, vault?.collateralToken).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} <span className="text-sm font-normal">USDA</span></p>
                        <p className="text-base font-normal leading-6 text-gray-500">Available to mint</p>
                      </div>
                      {isVaultOwner ? (
                        <button 
                          type="button" 
                          className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => setShowMintModal(true)}>
                          Mint
                        </button>
                      ) : null }
                    </div>

                    <div className="mt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-semibold leading-none">{totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} <span className="text-sm font-normal">USDA</span></p>
                          <p className="flex items-center text-base font-normal leading-6 text-gray-500">
                            Outstanding USDA debt 
                            <Tooltip className="ml-2" shouldWrapChildren={true} label={`Includes a ${collateralType?.stabilityFeeApy / 100}% yearly stability fee.`}>
                              <InformationCircleIcon className="block w-5 h-5 ml-2 text-gray-400" aria-hidden="true" />
                            </Tooltip>
                          </p>
                        </div>
                        {isVaultOwner ? (
                          <button 
                            type="button" 
                            className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={() => setShowBurnModal(true)}>
                            Pay back
                          </button>
                        ) : null }
                      </div>
                    </div>
                  </div>
                  <div className="pt-6">
                    <div className="sm:flex sm:items-start sm:justify-between">
                      <div>
                        <p className={`text-lg font-semibold leading-none ${debtClass(collateralType?.liquidationRatio, debtRatio)}`}>
                          {debtRatio}<span className="text-sm font-normal">%</span>
                        </p>
                        <p className="text-base font-normal leading-6 text-gray-500">Collateral to Debt ratio</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-lg font-semibold leading-none">
                          {collateralType?.liquidationRatio}<span className="text-sm font-normal">%</span>
                          </p>
                          <p className="text-base font-normal leading-6 text-gray-500">Minimum Ratio (before liquidation)</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold leading-none">
                          {collateralType?.liquidationPenalty}<span className="text-sm font-normal">%</span>
                          </p>
                          <p className="text-base font-normal leading-6 text-gray-500">Liquidation penalty</p>
                        </div>
                      </div>

                      <div className="p-4 mt-4 border-l-4 border-blue-400 rounded-tr-md rounded-br-md bg-blue-50">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 ml-3 md:flex md:justify-between">
                            <p className="text-sm text-blue-700">The current {vault?.collateralToken} price is <span className="font-semibold text-blue-900">${price / 1000000} USD</span>. You will be liquidated if the {vault?.collateralToken} price drops below <span className="font-semibold text-blue-900">${liquidationPrice()} USD</span>. Pay back the outstanding debt or deposit extra collateral to keep your vault healthy.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Container>
  )
};
