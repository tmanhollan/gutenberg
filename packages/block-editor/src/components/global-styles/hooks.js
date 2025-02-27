/**
 * External dependencies
 */
import fastDeepEqual from 'fast-deep-equal/es6';
import { get, set } from 'lodash';

/**
 * WordPress dependencies
 */
import { useContext, useCallback, useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as blocksStore } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { getValueFromVariable, getPresetVariableFromValue } from './utils';
import { GlobalStylesContext } from './context';
import { unlock } from '../../lock-unlock';

const EMPTY_CONFIG = { settings: {}, styles: {} };

const VALID_SETTINGS = [
	'appearanceTools',
	'useRootPaddingAwareAlignments',
	'border.color',
	'border.radius',
	'border.style',
	'border.width',
	'shadow.presets',
	'shadow.defaultPresets',
	'color.background',
	'color.custom',
	'color.customDuotone',
	'color.customGradient',
	'color.defaultDuotone',
	'color.defaultGradients',
	'color.defaultPalette',
	'color.duotone',
	'color.gradients',
	'color.link',
	'color.palette',
	'color.text',
	'custom',
	'dimensions.minHeight',
	'layout.contentSize',
	'layout.definitions',
	'layout.wideSize',
	'position.fixed',
	'position.sticky',
	'spacing.customSpacingSize',
	'spacing.spacingSizes',
	'spacing.spacingScale',
	'spacing.blockGap',
	'spacing.margin',
	'spacing.padding',
	'spacing.units',
	'typography.fuild',
	'typography.customFontSize',
	'typography.dropCap',
	'typography.fontFamilies',
	'typography.fontSizes',
	'typography.fontStyle',
	'typography.fontWeight',
	'typography.letterSpacing',
	'typography.lineHeight',
	'typography.textDecoration',
	'typography.textTransform',
];

export const useGlobalStylesReset = () => {
	const { user: config, setUserConfig } = useContext( GlobalStylesContext );
	const canReset = !! config && ! fastDeepEqual( config, EMPTY_CONFIG );
	return [
		canReset,
		useCallback(
			() => setUserConfig( () => EMPTY_CONFIG ),
			[ setUserConfig ]
		),
	];
};

export function useGlobalSetting( propertyPath, blockName, source = 'all' ) {
	const { setUserConfig, ...configs } = useContext( GlobalStylesContext );

	const appendedBlockPath = blockName ? '.blocks.' + blockName : '';
	const appendedPropertyPath = propertyPath ? '.' + propertyPath : '';
	const contextualPath = `settings${ appendedBlockPath }${ appendedPropertyPath }`;
	const globalPath = `settings${ appendedPropertyPath }`;
	const sourceKey = source === 'all' ? 'merged' : source;

	const settingValue = useMemo( () => {
		const configToUse = configs[ sourceKey ];
		if ( ! configToUse ) {
			throw 'Unsupported source';
		}

		if ( propertyPath ) {
			return (
				get( configToUse, contextualPath ) ??
				get( configToUse, globalPath )
			);
		}

		const result = {};
		VALID_SETTINGS.forEach( ( setting ) => {
			const value =
				get(
					configToUse,
					`settings${ appendedBlockPath }.${ setting }`
				) ?? get( configToUse, `settings.${ setting }` );
			if ( value ) {
				set( result, setting, value );
			}
		} );
		return result;
	}, [
		configs,
		sourceKey,
		propertyPath,
		contextualPath,
		globalPath,
		appendedBlockPath,
	] );

	const setSetting = ( newValue ) => {
		setUserConfig( ( currentConfig ) => {
			// Deep clone `currentConfig` to avoid mutating it later.
			const newUserConfig = JSON.parse( JSON.stringify( currentConfig ) );
			set( newUserConfig, contextualPath, newValue );

			return newUserConfig;
		} );
	};

	return [ settingValue, setSetting ];
}

export function useGlobalStyle(
	path,
	blockName,
	source = 'all',
	{ shouldDecodeEncode = true } = {}
) {
	const {
		merged: mergedConfig,
		base: baseConfig,
		user: userConfig,
		setUserConfig,
	} = useContext( GlobalStylesContext );
	const appendedPath = path ? '.' + path : '';
	const finalPath = ! blockName
		? `styles${ appendedPath }`
		: `styles.blocks.${ blockName }${ appendedPath }`;

	const setStyle = ( newValue ) => {
		setUserConfig( ( currentConfig ) => {
			// Deep clone `currentConfig` to avoid mutating it later.
			const newUserConfig = JSON.parse( JSON.stringify( currentConfig ) );
			set(
				newUserConfig,
				finalPath,
				shouldDecodeEncode
					? getPresetVariableFromValue(
							mergedConfig.settings,
							blockName,
							path,
							newValue
					  )
					: newValue
			);
			return newUserConfig;
		} );
	};

	let rawResult, result;
	switch ( source ) {
		case 'all':
			rawResult =
				// The stlyes.css path is allowed to be empty, so don't revert to base if undefined.
				finalPath === 'styles.css'
					? get( userConfig, finalPath )
					: get( mergedConfig, finalPath );
			result = shouldDecodeEncode
				? getValueFromVariable( mergedConfig, blockName, rawResult )
				: rawResult;
			break;
		case 'user':
			rawResult = get( userConfig, finalPath );
			result = shouldDecodeEncode
				? getValueFromVariable( mergedConfig, blockName, rawResult )
				: rawResult;
			break;
		case 'base':
			rawResult = get( baseConfig, finalPath );
			result = shouldDecodeEncode
				? getValueFromVariable( baseConfig, blockName, rawResult )
				: rawResult;
			break;
		default:
			throw 'Unsupported source';
	}

	return [ result, setStyle ];
}

/**
 * React hook that overrides a global settings object with block and element specific settings.
 *
 * @param {Object}     parentSettings Settings object.
 * @param {blockName?} blockName      Block name.
 * @param {element?}   element        Element name.
 *
 * @return {Object} Merge of settings and supports.
 */
export function useSettingsForBlockElement(
	parentSettings,
	blockName,
	element
) {
	const { supportedStyles, supports } = useSelect(
		( select ) => {
			return {
				supportedStyles: unlock(
					select( blocksStore )
				).getSupportedStyles( blockName, element ),
				supports:
					select( blocksStore ).getBlockType( blockName )?.supports,
			};
		},
		[ blockName, element ]
	);

	return useMemo( () => {
		const updatedSettings = { ...parentSettings };

		if ( ! supportedStyles.includes( 'fontSize' ) ) {
			updatedSettings.typography = {
				...updatedSettings.typography,
				fontSizes: {},
				customFontSize: false,
			};
		}

		if ( ! supportedStyles.includes( 'fontFamily' ) ) {
			updatedSettings.typography = {
				...updatedSettings.typography,
				fontFamilies: {},
			};
		}

		[
			'lineHeight',
			'fontStyle',
			'fontWeight',
			'letterSpacing',
			'textTransform',
			'textDecoration',
		].forEach( ( key ) => {
			if ( ! supportedStyles.includes( key ) ) {
				updatedSettings.typography = {
					...updatedSettings.typography,
					[ key ]: false,
				};
			}
		} );

		[ 'contentSize', 'wideSize' ].forEach( ( key ) => {
			if ( ! supportedStyles.includes( key ) ) {
				updatedSettings.layout = {
					...updatedSettings.layout,
					[ key ]: false,
				};
			}
		} );

		[ 'padding', 'margin', 'blockGap' ].forEach( ( key ) => {
			if ( ! supportedStyles.includes( key ) ) {
				updatedSettings.spacing = {
					...updatedSettings.spacing,
					[ key ]: false,
				};
			}

			const sides = Array.isArray( supports?.spacing?.[ key ] )
				? supports?.spacing?.[ key ]
				: supports?.spacing?.[ key ]?.sides;
			if ( sides?.length ) {
				updatedSettings.spacing = {
					...updatedSettings.spacing,
					[ key ]: {
						...updatedSettings.spacing?.[ key ],
						sides,
					},
				};
			}
		} );

		if ( ! supportedStyles.includes( 'minHeight' ) ) {
			updatedSettings.dimensions = {
				...updatedSettings.dimensions,
				minHeight: false,
			};
		}

		return updatedSettings;
	}, [ parentSettings, supportedStyles, supports ] );
}
