/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import SidebarNavigationScreen from '../sidebar-navigation-screen';
import NavigationInspector from '../navigation-inspector';
import { useHistory } from '../routes';

export default function SidebarNavigationScreenNavigationMenus() {
	const history = useHistory();
	const onSelect = useCallback(
		( selectedBlock ) => {
			const { attributes, name } = selectedBlock;
			if (
				attributes.kind === 'post-type' &&
				attributes.id &&
				attributes.type &&
				history
			) {
				history.push( {
					postType: attributes.type,
					postId: attributes.id,
				} );
			}
			if ( name === 'core/page-list-item' && attributes.id && history ) {
				history.push( {
					postType: 'page',
					postId: attributes.id,
				} );
			}
		},
		[ history ]
	);
	return (
		<SidebarNavigationScreen
			title={ __( 'Navigation' ) }
			content={
				<div className="edit-site-sidebar-navigation-screen-navigation-menus">
					<NavigationInspector onSelect={ onSelect } />
				</div>
			}
		/>
	);
}
