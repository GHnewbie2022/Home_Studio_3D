bl_info = {
    "name": "Home Studio Viewpoints",
    "author": "Home Studio Blender Native",
    "version": (1, 8, 1),
    "blender": (5, 0, 0),
    "location": "3D Viewport > Sidebar > Home Studio",
    "description": "Switch Home Studio cameras and enter Walk mode",
    "category": "3D View",
}

import bpy
from bpy.app.handlers import persistent


CAMERAS = (
    ("Camera_View_01", "視角 1"),
    ("Camera_View_02", "視角 2"),
    ("Camera_View_03", "視角 3"),
)
WALK_CAMERA_NAME = "Camera_Walk"
SOUTH_WALL_NAME = "Wall_South"
SOUTH_WALL_INTERIOR_Y = -3.046
NORMAL_CLIP_START = 0.01


def sync_camera_side_wall_visibility(scene=None):
    scene = scene or getattr(bpy.context, "scene", None)
    if scene is None:
        return
    camera = scene.camera
    south_wall = bpy.data.objects.get(SOUTH_WALL_NAME)
    if camera is None or south_wall is None:
        return

    camera_is_outside_south = camera.matrix_world.translation.y < SOUTH_WALL_INTERIOR_Y
    south_wall.visible_camera = not camera_is_outside_south


@persistent
def home_studio_visibility_sync(scene, depsgraph):
    sync_camera_side_wall_visibility(scene)


def remove_visibility_handlers():
    for handler in tuple(bpy.app.handlers.depsgraph_update_post):
        if (
            getattr(handler, "__module__", None) == __name__
            and getattr(handler, "__name__", None) == "home_studio_visibility_sync"
        ):
            bpy.app.handlers.depsgraph_update_post.remove(handler)


def set_camera_view(context, camera, *, lock_camera):
    region_3d = context.space_data.region_3d
    window_region = next(region for region in context.area.regions if region.type == "WINDOW")
    context.scene.camera = camera
    sync_camera_side_wall_visibility(context.scene)
    context.space_data.lock_camera = lock_camera
    camera.data.show_passepartout = True
    camera.data.passepartout_alpha = 1.0
    region_3d.view_camera_offset = (0.0, 0.0)
    region_3d.view_camera_zoom = 0.0
    region_3d.view_perspective = "CAMERA"
    region_3d.update()
    with context.temp_override(region=window_region):
        bpy.ops.view3d.view_center_camera()


def get_walk_camera(source_camera):
    walk_camera = bpy.data.objects.get(WALK_CAMERA_NAME)
    if walk_camera is None:
        camera_data = source_camera.data.copy()
        camera_data.name = WALK_CAMERA_NAME
        walk_camera = bpy.data.objects.new(WALK_CAMERA_NAME, camera_data)
        source_camera.users_collection[0].objects.link(walk_camera)

    walk_camera.matrix_world = source_camera.matrix_world.copy()
    walk_camera.data.lens = source_camera.data.lens
    walk_camera.data.sensor_fit = source_camera.data.sensor_fit
    walk_camera.data.sensor_width = source_camera.data.sensor_width
    walk_camera.data.sensor_height = source_camera.data.sensor_height
    walk_camera.data.shift_x = source_camera.data.shift_x
    walk_camera.data.shift_y = source_camera.data.shift_y
    walk_camera.data.clip_start = NORMAL_CLIP_START
    walk_camera.data.clip_end = source_camera.data.clip_end
    return walk_camera


class HOME_STUDIO_OT_viewpoint(bpy.types.Operator):
    bl_idname = "home_studio.viewpoint"
    bl_label = "切換 Home Studio 視角"
    bl_options = {"REGISTER"}

    camera_name: bpy.props.StringProperty()

    def execute(self, context):
        camera = bpy.data.objects.get(self.camera_name)
        if camera is None or camera.type != "CAMERA":
            self.report({"ERROR"}, f"找不到相機：{self.camera_name}")
            return {"CANCELLED"}

        context.scene["home_studio_last_view_camera"] = camera.name
        set_camera_view(context, camera, lock_camera=False)
        return {"FINISHED"}


class HOME_STUDIO_OT_walk(bpy.types.Operator):
    bl_idname = "home_studio.walk"
    bl_label = "自由走動"
    bl_options = {"REGISTER"}

    def invoke(self, context, event):
        source_camera = context.scene.camera
        if source_camera is None or source_camera.type != "CAMERA":
            self.report({"ERROR"}, "目前場景沒有作用中的固定相機")
            return {"CANCELLED"}

        walk_camera = get_walk_camera(source_camera)
        set_camera_view(context, walk_camera, lock_camera=True)

        window_region = next(
            (region for region in context.area.regions if region.type == "WINDOW"),
            None,
        )
        if window_region is None:
            self.report({"ERROR"}, "找不到 3D Viewport 視窗區域")
            return {"CANCELLED"}

        with context.temp_override(region=window_region):
            return bpy.ops.view3d.walk("INVOKE_DEFAULT")


class HOME_STUDIO_PT_viewpoints(bpy.types.Panel):
    bl_label = "Home Studio 視角"
    bl_idname = "HOME_STUDIO_PT_viewpoints"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Home Studio"

    def draw(self, context):
        layout = self.layout
        for camera_name, label in CAMERAS:
            operator = layout.operator("home_studio.viewpoint", text=label, icon="CAMERA_DATA")
            operator.camera_name = camera_name
        layout.separator()
        layout.operator("home_studio.walk", text="自由走動", icon="VIEW_PAN")


CLASSES = (
    HOME_STUDIO_OT_viewpoint,
    HOME_STUDIO_OT_walk,
    HOME_STUDIO_PT_viewpoints,
)


def register():
    for class_ in CLASSES:
        bpy.utils.register_class(class_)
    remove_visibility_handlers()
    bpy.app.handlers.depsgraph_update_post.append(home_studio_visibility_sync)
    sync_camera_side_wall_visibility()


def unregister():
    remove_visibility_handlers()
    south_wall = bpy.data.objects.get(SOUTH_WALL_NAME)
    if south_wall is not None:
        south_wall.visible_camera = True
    for class_ in reversed(CLASSES):
        bpy.utils.unregister_class(class_)


if __name__ == "__main__":
    register()
