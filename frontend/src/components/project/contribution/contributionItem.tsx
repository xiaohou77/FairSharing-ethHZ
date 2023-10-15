import {
	Button,
	Checkbox,
	Divider,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	Paper,
	Popover,
	styled,
	Tooltip,
	Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { Img3 } from '@lxdao/img3';
import { formatDistance } from 'date-fns';

import Link from 'next/link';
import MuiLink from '@mui/material/Link';

import { useNetwork } from 'wagmi';

import StatusText from '@/components/project/contribution/statusText';
import Pizza from '@/components/project/contribution/pizza';
import { StyledFlexBox } from '@/components/styledComponents';
import { IContribution, IContributor, IProject } from '@/services/types';
import VoteAction, { VoteTypeEnum } from '@/components/project/contribution/voteAction';
import PostContribution from '@/components/project/contribution/postContribution';
import {
	IClaimParams,
	IVoteParams,
	IVoteValueEnum,
} from '@/components/project/contribution/contributionList';
import { EasAttestation, EasAttestationData, EasAttestationDecodedData } from '@/services/eas';
import { EAS_CHAIN_CONFIGS, EasSchemaVoteKey } from '@/constant/eas';
import { showToast } from '@/store/utils';
import MiniContributorList from '@/components/project/contribution/miniContributorList';
import { EasLogoIcon, FileIcon, LinkIcon, MoreIcon } from '@/icons';
import useCountdown from '@/hooks/useCountdown';

export interface IContributionItemProps {
	contribution: IContribution;
	projectDetail: IProject;
	showSelect: boolean;
	selected: number[];
	onSelect: (idList: number[]) => void;
	showDeleteDialog: (contributionId: number) => void;
	onVote: (params: IVoteParams) => void;
	onClaim: (params: IClaimParams) => void;
	easVoteList: EasAttestation<EasSchemaVoteKey>[];
	contributorList: IContributor[];
}

const ContributionItem = (props: IContributionItemProps) => {
	const {
		contribution,
		selected,
		onSelect,
		showSelect,
		showDeleteDialog,
		projectDetail,
		easVoteList,
		contributorList,
	} = props;
	const { chain } = useNetwork();

	const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
	const [openMore, setOpenMore] = useState(false);
	const [openProof, setOpenProof] = useState(false);
	const [openContributor, setOpenContributor] = useState(false);
	const [showEdit, setShowEdit] = useState(false);

	const targetTime = useCountdownTarget(contribution, projectDetail);
	const { isEnd } = useCountdown(targetTime);

	const userVoteInfoMap = useMemo(() => {
		const userVoterMap: Record<string, number[]> = {};
		easVoteList?.forEach((vote) => {
			const { signer } = vote.data as EasAttestationData;
			const decodedDataJson =
				vote.decodedDataJson as EasAttestationDecodedData<EasSchemaVoteKey>[];
			const voteValueItem = decodedDataJson.find((item) => item.name === 'VoteChoice');
			if (voteValueItem) {
				const voteNumber = voteValueItem.value.value as IVoteValueEnum;
				if (userVoterMap[signer]) {
					userVoterMap[signer].push(voteNumber);
				} else {
					userVoterMap[signer] = [voteNumber];
				}
			}
		});
		return userVoterMap;
	}, [easVoteList]);

	const voteNumbers = useMemo(() => {
		let For = 0,
			Against = 0,
			Abstain = 0;
		for (const [signer, value] of Object.entries(userVoteInfoMap)) {
			// 同一用户取最新投票
			const voteNumber = value[value.length - 1];
			if (voteNumber === IVoteValueEnum.FOR) {
				For += 1;
			} else if (voteNumber === IVoteValueEnum.AGAINST) {
				Against += 1;
			} else if (voteNumber === IVoteValueEnum.ABSTAIN) {
				Abstain += 1;
			}
		}
		return { For, Against, Abstain };
	}, [userVoteInfoMap]);

	const EasLink = useMemo(() => {
		const activeChainConfig =
			EAS_CHAIN_CONFIGS.find((config) => config.chainId === chain?.id) ||
			EAS_CHAIN_CONFIGS[2];
		return `${activeChainConfig.etherscanURL}/offchain/attestation/view/${contribution.uId}`;
	}, [contribution, chain]);

	const matchContributors = useMemo(() => {
		return contributorList.filter((item) => contribution.toIds.includes(item.id));
	}, [contributorList, contribution]);

	const toContributors = useMemo(() => {
		const maxNum = 2;
		if (matchContributors.length > maxNum) {
			const names = matchContributors.slice(0, maxNum).reduce((pre, cur, currentIndex) => {
				return `${pre} ${currentIndex > 0 ? ', ' : ''}${cur.nickName}`;
			}, '');
			return `${names}, +${matchContributors.length - maxNum}`;
		} else {
			return matchContributors.reduce((pre, cur, currentIndex) => {
				return `${pre} ${currentIndex > 0 ? ', ' : ''}${cur.nickName}`;
			}, '');
		}
	}, [matchContributors]);

	const hasVoted = useMemo(() => {
		const { For, Against, Abstain } = voteNumbers;
		return !(For === 0 && Against === 0 && Abstain === 0);
	}, [voteNumbers]);

	const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		console.log('handleCheckboxChange', event.target.checked);
		const checked = event.target.checked;
		const newList = checked
			? [...selected, contribution.id]
			: selected.filter((id) => Number(id) !== Number(contribution.id));
		onSelect(newList);
	};

	const handleVote = (voteValue: IVoteValueEnum) => {
		if (contribution.status === 'UNREADY') {
			showToast(`Contribution is not ready!`, 'error');
			return false;
		}
		// 投票时间结束后，不允许继续Vote
		if (Date.now() >= targetTime) {
			showToast(`Vote ended, can't vote`, 'error');
			return false;
		}
		if (contribution.status === 'CLAIM') {
			showToast(`Can't vote after the contribution is claimed!`, 'error');
			return false;
		}

		// 同一用户允许继续vote
		props.onVote({
			contributionId: contribution.id,
			uId: contribution.uId as string,
			value: voteValue,
		});
	};

	const getVoteResult = () => {
		const voters: string[] = [];
		const voterValues: number[] = [];
		for (const [signer, value] of Object.entries(userVoteInfoMap)) {
			voters.push(signer);
			// 同一用户取最新投票
			const lastVote = value[value.length - 1];
			voterValues.push(lastVote);
		}
		return {
			voters: voters,
			voterValues: voterValues,
		};
	};

	const handleClaim = () => {
		const { voters, voterValues } = getVoteResult();
		console.log('voters', voters);
		console.log('voterValues', voterValues);
		props.onClaim({
			contributionId: contribution.id,
			uId: contribution.uId || ('' as string),
			token: contribution.credit,
			voters: voters,
			voteValues: voterValues,
			toIds: contribution.toIds,
		});
	};

	const handleOpenMorePopover = (event: React.MouseEvent<HTMLButtonElement>) => {
		setAnchorEl(event.currentTarget);
		setOpenMore(true);
	};

	const handleOpenProofPopover = (event: React.MouseEvent<HTMLDivElement>) => {
		setAnchorEl(event.currentTarget);
		setOpenProof(true);
	};

	const handleOpenContributorPopover = (event: React.MouseEvent<HTMLDivElement>) => {
		setAnchorEl(event.currentTarget);
		setOpenContributor(true);
	};
	const handleClosePopover = () => {
		setAnchorEl(null);
		setOpenMore(false);
		setOpenProof(false);
		setOpenContributor(false);
	};

	const onEdit = () => {
		console.log('onEdit');
		setShowEdit(true);
		handleClosePopover();
	};

	const onDelete = () => {
		showDeleteDialog(contribution.id);
		handleClosePopover();
	};

	const onCancel = useCallback(() => {
		setShowEdit(false);
	}, []);

	const onPost = useCallback(() => {
		console.log('re-post');
	}, []);

	return (
		<>
			<StyledFlexBox
				sx={{
					alignItems: 'flex-start',
					paddingTop: '16px',
					display: showEdit ? 'none' : 'flex',
				}}
			>
				<StyledFlexBox sx={{ marginRight: '16px', maxWidth: '94px' }}>
					{showSelect ? (
						<Checkbox
							checked={selected.includes(Number(contribution.id))}
							onChange={handleCheckboxChange}
						/>
					) : null}
					{/*TODO 改为贡献人的logo 不是project*/}
					<Img3
						src={projectDetail.logo}
						style={{ width: '48px', height: '48px', borderRadius: '48px' }}
					/>
				</StyledFlexBox>
				<div style={{ flex: 1 }}>
					<StyledFlexBox sx={{ height: 28, justifyContent: 'space-between' }}>
						<StyledFlexBox>
							{/*TODO 改为贡献人的名字*/}
							<Typography variant={'body1'} sx={{ fontWeight: 500 }}>
								{projectDetail.name}
							</Typography>
							<Typography
								variant={'body2'}
								sx={{ marginLeft: '12px', color: '#64748B' }}
							>
								{formatDistance(new Date(contribution.createAt), new Date(), {
									includeSeconds: false,
									addSuffix: true,
								})}
							</Typography>
						</StyledFlexBox>
						<StyledFlexBox>
							<StatusText
								contribution={contribution}
								onClaim={handleClaim}
								targetTime={targetTime}
								hasVoted={hasVoted}
								votePass={
									hasVoted &&
									voteNumbers.For > 0 &&
									voteNumbers.For >= voteNumbers.Against
								}
							/>
							<Tooltip title="View on chain" placement="top" arrow={true}>
								<Link
									href={EasLink}
									target={'_blank'}
									style={{ cursor: 'pointer', margin: '0 24px' }}
								>
									<EasLogoIcon width={52} height={24} />
								</Link>
							</Tooltip>

							<div>
								<IconButton size="small" onClick={handleOpenMorePopover}>
									<MoreIcon width={24} height={24} />
								</IconButton>
								<Popover
									id={'simple-popover-more'}
									open={openMore}
									anchorEl={anchorEl}
									onClose={handleClosePopover}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
									transformOrigin={{ vertical: 'top', horizontal: 'right' }}
								>
									<Paper>
										<List>
											<ListItem disablePadding>
												<ListItemButton onClick={onEdit}>
													Edit
												</ListItemButton>
											</ListItem>
											<ListItem disablePadding>
												<ListItemButton onClick={onDelete}>
													Revoke
												</ListItemButton>
											</ListItem>
										</List>
									</Paper>
								</Popover>
							</div>
						</StyledFlexBox>
					</StyledFlexBox>
					<Typography sx={{ margin: '2px 0 12px' }}>{contribution.detail}</Typography>
					<StyledFlexBox sx={{ justifyContent: 'space-between' }}>
						<StyledFlexBox>
							{/*pizza status*/}

							<Pizza
								credit={contribution.credit}
								status={contribution.status}
								targetTime={targetTime}
								votePass={
									hasVoted &&
									voteNumbers.For > 0 &&
									voteNumbers.For >= voteNumbers.Against
								}
							/>

							{/*proof*/}

							<>
								<CustomHoverButton
									sx={{ cursor: 'pointer', margin: '0 8px' }}
									onClick={handleOpenProofPopover}
								>
									<FileIcon width={14} height={14} />
									<Typography
										variant={'body2'}
										sx={{
											fontWeight: '500',
											color: '#475569',
											marginLeft: '4px',
										}}
									>
										Proof
									</Typography>
								</CustomHoverButton>
								<Popover
									id={'simple-popover-proof'}
									open={openProof}
									anchorEl={anchorEl}
									onClose={handleClosePopover}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
									transformOrigin={{ vertical: 'top', horizontal: 'left' }}
									disableRestoreFocus
								>
									<Paper sx={{ padding: '12px' }}>
										<MuiLink
											href={contribution.proof}
											target={'_blank'}
											underline={'hover'}
										>
											<LinkIcon
												width={16}
												height={16}
												style={{ marginRight: 8 }}
											/>
											{contribution.proof}
										</MuiLink>
									</Paper>
								</Popover>
							</>

							{/*contributors*/}

							<>
								<CustomHoverButton
									sx={{ cursor: 'pointer', margin: '0 8px' }}
									onClick={handleOpenContributorPopover}
								>
									<Typography
										variant={'body2'}
										sx={{ fontWeight: '500', color: '#475569' }}
									>
										@{toContributors}
									</Typography>
								</CustomHoverButton>
								<Popover
									id={'simple-popover-contributor'}
									open={openContributor}
									anchorEl={anchorEl}
									onClose={handleClosePopover}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
									transformOrigin={{ vertical: 'top', horizontal: 'left' }}
									disableRestoreFocus
								>
									<Paper sx={{ padding: '12px', maxWidth: '500px' }}>
										<MiniContributorList contributorList={matchContributors} />
									</Paper>
								</Popover>
							</>
						</StyledFlexBox>

						<StyledFlexBox>
							<VoteAction
								type={VoteTypeEnum.FOR}
								contributionStatus={contribution.status}
								count={voteNumbers.For}
								contribution={contribution}
								onConfirm={() => handleVote(IVoteValueEnum.FOR)}
								isEnd={isEnd}
							/>
							<VoteAction
								type={VoteTypeEnum.AGAINST}
								contributionStatus={contribution.status}
								count={voteNumbers.Against}
								contribution={contribution}
								onConfirm={() => handleVote(IVoteValueEnum.AGAINST)}
								isEnd={isEnd}
							/>
							<VoteAction
								type={VoteTypeEnum.ABSTAIN}
								contributionStatus={contribution.status}
								count={voteNumbers.Abstain}
								contribution={contribution}
								onConfirm={() => handleVote(IVoteValueEnum.ABSTAIN)}
								isEnd={isEnd}
							/>
						</StyledFlexBox>
					</StyledFlexBox>
					{!showEdit ? <Divider sx={{ marginTop: '24px' }} /> : null}
				</div>
			</StyledFlexBox>

			{showEdit ? (
				<PostContribution
					projectId={projectDetail.id}
					contribution={contribution}
					onCancel={onCancel}
				/>
			) : null}
		</>
	);
};

export default ContributionItem;

export function useCountdownTarget(contribution: IContribution, projectDetail: IProject) {
	const targetTime = useMemo(() => {
		return (
			new Date(contribution.createAt).getTime() +
			Number(projectDetail.votePeriod) * 24 * 60 * 60 * 1000
		);
	}, [contribution.createAt, projectDetail.votePeriod]);

	return targetTime;
}

export const CustomHoverButton = styled(StyledFlexBox)({
	borderRadius: 4,
	height: 28,
	padding: '0 8px',
	border: '0.5px solid rgba(15, 23, 42, 0.16)',
	'&:hover': {
		backgroundColor: 'rgba(203, 213, 225, .3)',
	},
});
